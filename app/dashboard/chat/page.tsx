"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Sparkles, ArrowLeft, Calendar as CalendarIcon, WifiOff, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Label } from "@/components/ui/label"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_PROMPTS = [
  {
    label: "Quais leads devo priorizar?",
    prompt: "Analise meus leads e me diga quais devo priorizar hoje para aumentar minhas chances de fechar vendas. Considere valor, estágio e urgência."
  },
  {
    label: "Oportunidades urgentes",
    prompt: "Quais são as oportunidades mais urgentes que preciso agir agora? Liste leads com maior risco de perda ou maior potencial de fechamento imediato."
  },
  {
    label: "Sugestões de produtos",
    prompt: "Com base nos meus clientes e leads atuais, que produtos devo focar em vender esta semana?"
  },
  {
    label: "Análise de performance",
    prompt: "Faça uma análise da minha performance de vendas. Quantos leads tenho, qual o valor total em negociação e quais ações devo tomar?"
  }
]

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState("")
  const [loadingMessage, setLoadingMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Estado para filtro de data
  const [filtro, setFiltro] = useState(() => {
    const dataFim = new Date()
    const dataInicio = new Date()
    dataInicio.setDate(dataFim.getDate() - 90) // últimos 90 dias

    return {
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: dataFim.toISOString().split('T')[0]
    }
  })

  // Estado para rastrear se o filtro de data foi alterado e precisa de nova busca
  const [filtroAlterado, setFiltroAlterado] = useState(false);

  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random()}`)

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      router.push("/")
    }

    // Verificar status de conexão
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingMessage])

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || input
    if (!messageToSend.trim() || isLoading) return

    // Se o filtro foi alterado, limpa as mensagens e reseta o estado
    if (filtroAlterado) {
      setMessages([]);
      setIsFirstMessage(true);
      setFiltroAlterado(false); // Reseta o flag
    }

    const userMessage: Message = { role: "user", content: messageToSend }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setLoadingMessage("Analisando sua solicitação...")
    setStreamingMessage("")
    setIsFirstMessage(false)

    try {
      setLoadingMessage("Carregando dados do sistema...");
      console.log(`💬 Enviando mensagem: "${messageToSend.substring(0, 50)}..."`);

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          history: messages,
          filtro: {
            dataInicio: filtro.dataInicio,
            dataFim: filtro.dataFim
          },
          sessionId
        })
      })

      setLoadingMessage("Processando resposta da IA...");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || "Erro ao processar resposta")
      }

      if (!response.body) {
        throw new Error("Response body não disponível")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ""
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log("Stream finalizado, texto acumulado:", accumulatedText.length, "caracteres")
            break
          }

          // Decodificar o chunk e adicionar ao buffer
          buffer += decoder.decode(value, { stream: true })

          // Processar linhas completas do buffer
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Mantém a última linha incompleta no buffer

          for (const line of lines) {
            if (!line.trim()) continue

            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim()

              if (data === "[DONE]") {
                console.log("Recebido sinal [DONE]")
                continue
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulatedText += parsed.text
                  setStreamingMessage(accumulatedText)
                } else if (parsed.error) {
                  console.error("Erro no streaming:", parsed.error)
                  throw new Error(parsed.error)
                } else if (parsed.progress !== undefined) {
                  // Atualiza o progresso da barra de carregamento
                  setLoadingProgress(parsed.progress);
                  setLoadingMessage(parsed.message || 'Processando...');
                }
              } catch (e) {
                if (data !== "[DONE]") {
                  console.error("Erro ao parsear chunk:", data, e)
                }
              }
            }
          }
        }

        // Adicionar mensagem final ao histórico
        if (accumulatedText) {
          setMessages(prev => [...prev, { role: "assistant", content: accumulatedText }])
          setStreamingMessage("")
          console.log(`✅ Resposta recebida: ${accumulatedText.length} caracteres`);
        } else {
          throw new Error("Nenhuma resposta recebida do assistente")
        }
      } catch (streamError) {
        console.error("Erro durante streaming:", streamError)
        throw streamError
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}`
      }])
      setStreamingMessage("")
    } finally {
      setIsLoading(false)
      setLoadingMessage("")
      setLoadingProgress(0); // Reseta o progresso após o carregamento
    }
  }

  const handleChipClick = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleBackToIA = () => {
    router.push("/dashboard");
  };

  if (!isOnline) {
    return (
      <DashboardLayout hideFloatingMenu={true}>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">IA Assistente Indisponível Offline</h3>
                <p className="text-sm text-muted-foreground">
                  O Assistente de IA requer conexão com a internet para funcionar. Por favor, conecte-se à internet para acessar esta funcionalidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout hideFloatingMenu={true}>
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Header com Botão Voltar e Filtro de Data */}
        <div className="border-b p-4 flex flex-col sm:flex-col items-start sm:items-center justify-between gap-3">
          <div className="flex w-full justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToIA}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para escolhas de IA
            </Button>

            {/* Filtro de Data */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Input
                  id="dataInicio"
                  type="date"
                  value={filtro.dataInicio}
                  onChange={(e) => {
                    const novaDataInicio = e.target.value;
                    const dataFimAtual = new Date(filtro.dataFim);
                    const seisMesesDepois = new Date(novaDataInicio);
                    seisMesesDepois.setMonth(seisMesesDepois.getMonth() + 6);

                    if (dataFimAtual > seisMesesDepois) {
                      alert('O intervalo máximo permitido é de 6 meses');
                      return;
                    }

                    setFiltro(prev => ({ ...prev, dataInicio: novaDataInicio }));
                    setFiltroAlterado(true);
                    console.log('Filtro de data alterado: dataInicio para', novaDataInicio);
                  }}
                  className="w-36 h-9"
                  disabled={isLoading}
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  id="dataFim"
                  type="date"
                  value={filtro.dataFim}
                  onChange={(e) => {
                    const novaDataFim = e.target.value;
                    const dataInicioAtual = new Date(filtro.dataInicio);
                    const seisMesesDepois = new Date(dataInicioAtual);
                    seisMesesDepois.setMonth(seisMesesDepois.getMonth() + 6);
                    const dataFimNova = new Date(novaDataFim);

                    if (dataFimNova > seisMesesDepois) {
                      alert('O intervalo máximo permitido é de 6 meses');
                      return;
                    }

                    setFiltro(prev => ({ ...prev, dataFim: novaDataFim }));
                    setFiltroAlterado(true);
                    console.log('Filtro de data alterado: dataFim para', novaDataFim);
                  }}
                  className="w-36 h-9"
                  disabled={isLoading}
                />
              </div>
              {(filtro.dataInicio !== (new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]) || filtro.dataFim !== (new Date().toISOString().split('T')[0])) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const dataFim = new Date()
                    const dataInicio = new Date()
                    dataInicio.setDate(dataFim.getDate() - 90)
                    setFiltro({
                      dataInicio: dataInicio.toISOString().split('T')[0],
                      dataFim: dataFim.toISOString().split('T')[0]
                    })
                    setMessages([])
                    setIsFirstMessage(true)
                    setFiltroAlterado(false); // Reseta o flag ao limpar o filtro
                    console.log('Filtro de data resetado e messages limpas.');
                  }}
                  className="text-xs"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full py-12 space-y-6">
              <div className="flex items-center gap-2 text-primary">
                <img src="/1.png" alt="Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-semibold">Assistente de Vendas</h1>
              </div>
              <p className="text-center text-muted-foreground max-w-md">
                Olá! Sou seu Assistente de Vendas com IA. Posso analisar seus leads, parceiros e produtos para sugerir as melhores ações comerciais. Como posso ajudar você a vender mais hoje?
              </p>

              {/* Chips de Sugestões */}
              <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                {SUGGESTED_PROMPTS.map((promptData) => (
                  <Button
                    key={promptData.label}
                    variant="outline"
                    className="rounded-full"
                    onClick={() => handleChipClick(promptData.prompt)}
                  >
                    {promptData.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Card
                    className={`max-w-[80%] p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </Card>
                </div>
              ))}

              {/* Mensagem em Streaming */}
              {streamingMessage && (
                <div className="flex justify-start">
                  <Card className="max-w-[80%] p-4 bg-muted">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {streamingMessage}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </div>
              )}

              {isLoading && !streamingMessage && (
                <div className="flex justify-start">
                  <Card className="max-w-[80%] p-4 bg-muted">
                    <div className="flex items-center gap-2">
                      <img
                        src="/anigif.gif"
                        alt="Carregando..."
                        className="w-8 h-8"
                      />
                      <span className="text-sm text-muted-foreground">{loadingMessage || "Pensando..."}</span>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* Barra de Progresso de Carregamento de Dados */}
          {isLoadingData && (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
            <div className="w-full max-w-md space-y-2">
              <p className="text-sm font-medium text-center">{loadingMessage || 'Carregando dados...'}</p>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">{loadingProgress}%</p>
            </div>
          </div>
        )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Input Fixa */}
        <div className="border-t bg-background p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage(input)}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}