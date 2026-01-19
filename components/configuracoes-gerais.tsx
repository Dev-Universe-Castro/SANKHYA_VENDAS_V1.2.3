
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ContratoData {
  EMPRESA: string
  IS_SANDBOX: string
  AUTH_TYPE?: string
  SANKHYA_TOKEN: string
  SANKHYA_APPKEY: string
  SANKHYA_USERNAME: string
  SANKHYA_PASSWORD: string
  OAUTH_CLIENT_ID?: string
  OAUTH_CLIENT_SECRET?: string
  OAUTH_X_TOKEN?: string
  GEMINI_API_KEY: string
  ATIVO: string
}

export default function ConfiguracoesGerais() {
  const [contrato, setContrato] = useState<ContratoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSankhyaPassword, setShowSankhyaPassword] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [validatingToken, setValidatingToken] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ token: string, expiry: string } | null>(null)

  const fetchContrato = async () => {
    try {
      setLoading(true)
      
      // Primeiro tenta pegar do localStorage
      let userData = null
      const storedUser = localStorage.getItem('currentUser')
      
      if (storedUser) {
        userData = JSON.parse(storedUser)
      } else {
        // Se não tiver no localStorage, tenta pegar do cookie
        const userCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user='))

        if (!userCookie) {
          toast.error("Usuário não autenticado")
          return
        }

        const cookieValue = userCookie.split('=')[1]
        userData = JSON.parse(decodeURIComponent(cookieValue))
      }

      const idEmpresa = userData.ID_EMPRESA || userData.id_empresa

      if (!idEmpresa) {
        toast.error("Empresa não identificada")
        return
      }

      const response = await fetch(`/api/configuracoes/credenciais?idEmpresa=${idEmpresa}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar credenciais')
      }

      const data = await response.json()
      setContrato(data.contrato)
    } catch (error) {
      console.error('Erro ao buscar contrato:', error)
      toast.error("Erro ao carregar credenciais da empresa")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContrato()
  }, [])

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copiado!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error("Erro ao copiar")
    }
  }

  const maskValue = (value: string, show: boolean) => {
    if (show || !value) return value
    return '•'.repeat(Math.min(value.length, 20))
  }

  const validarTokenSankhya = async () => {
    try {
      if (!contrato) return;
      setValidatingToken(true)
      const response = await fetch('/api/auth/validate-token', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato })
      })
      const data = await response.json()
      
      if (data.success) {
        setTokenInfo({ token: data.token, expiry: data.expiry })
        toast.success("Bearer Token gerado com sucesso!")
      } else {
        toast.error(data.error || "Erro ao gerar token")
      }
    } catch (error) {
      toast.error("Erro na comunicação com a API")
    } finally {
      setValidatingToken(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Credenciais e informações da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!contrato) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Credenciais e informações da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma credencial encontrada para esta empresa
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Validação de API (Bearer Token)</CardTitle>
              <CardDescription>Verifique se as credenciais estão gerando o token corretamente</CardDescription>
            </div>
            <Button 
              onClick={validarTokenSankhya} 
              disabled={validatingToken}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${validatingToken ? 'animate-spin' : ''}`} />
              {validatingToken ? 'Validando...' : 'Validar Conexão'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tokenInfo ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <Check className="w-5 h-5" />
                Conexão Estabelecida com Sucesso
              </div>
              <div className="space-y-1">
                <Label className="text-green-800 text-xs">Bearer Token Gerado:</Label>
                <div className="flex gap-2">
                  <Input 
                    value={tokenInfo.token} 
                    readOnly 
                    className="bg-white border-green-200 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-green-200"
                    onClick={() => copyToClipboard(tokenInfo.token, 'Bearer Token')}
                  >
                    {copiedField === 'Bearer Token' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-green-600" />}
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-green-600">
                Expira em: {new Date(tokenInfo.expiry).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
              Clique em "Validar Conexão" para testar suas credenciais Sankhya.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>Dados gerais do contrato</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchContrato}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar Dados
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={contrato.EMPRESA} readOnly />
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <div>
              <Badge variant={contrato.IS_SANDBOX === 'S' ? 'secondary' : 'default'}>
                {contrato.IS_SANDBOX === 'S' ? 'Sandbox (Teste)' : 'Produção'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status do Contrato</Label>
            <div>
              <Badge variant={contrato.ATIVO === 'S' ? 'default' : 'destructive'}>
                {contrato.ATIVO === 'S' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais Sankhya</CardTitle>
          <CardDescription>Credenciais de acesso à API Sankhya</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.SANKHYA_TOKEN, showSankhyaPassword)} 
                readOnly 
                type={showSankhyaPassword ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_TOKEN, 'Token')}
              >
                {copiedField === 'Token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Autenticação</Label>
            <Input 
              value={contrato.AUTH_TYPE || 'LEGACY'} 
              readOnly 
              className="font-semibold"
            />
          </div>

          {(!contrato.AUTH_TYPE || contrato.AUTH_TYPE === 'LEGACY') && (
            <>
              <div className="space-y-2">
                <Label>App Key</Label>
                <div className="flex gap-2">
                  <Input 
                    value={maskValue(contrato.SANKHYA_APPKEY, showSankhyaPassword)} 
                    readOnly 
                    type={showSankhyaPassword ? "text" : "password"}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(contrato.SANKHYA_APPKEY, 'App Key')}
                  >
                    {copiedField === 'App Key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex gap-2">
                  <Input value={contrato.SANKHYA_USERNAME} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(contrato.SANKHYA_USERNAME, 'Username')}
                  >
                    {copiedField === 'Username' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          {contrato.AUTH_TYPE === 'OAUTH2' && (
            <>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <div className="flex gap-2">
                  <Input 
                    value={maskValue(contrato.OAUTH_CLIENT_ID, showSankhyaPassword)} 
                    readOnly 
                    type={showSankhyaPassword ? "text" : "password"}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(contrato.OAUTH_CLIENT_ID, 'Client ID')}
                  >
                    {copiedField === 'Client ID' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="flex gap-2">
                  <Input 
                    value={maskValue(contrato.OAUTH_CLIENT_SECRET, showSankhyaPassword)} 
                    readOnly 
                    type={showSankhyaPassword ? "text" : "password"}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(contrato.OAUTH_CLIENT_SECRET, 'Client Secret')}
                  >
                    {copiedField === 'Client Secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>X-Token</Label>
                <div className="flex gap-2">
                  <Input 
                    value={maskValue(contrato.OAUTH_X_TOKEN, showSankhyaPassword)} 
                    readOnly 
                    type={showSankhyaPassword ? "text" : "password"}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(contrato.OAUTH_X_TOKEN, 'X-Token')}
                  >
                    {copiedField === 'X-Token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Password</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.SANKHYA_PASSWORD, showSankhyaPassword)} 
                readOnly 
                type={showSankhyaPassword ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSankhyaPassword(!showSankhyaPassword)}
              >
                {showSankhyaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_PASSWORD, 'Password')}
              >
                {copiedField === 'Password' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais Google Gemini</CardTitle>
          <CardDescription>API Key para inteligência artificial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.GEMINI_API_KEY || 'Não configurado', showGeminiKey)} 
                readOnly 
                type={showGeminiKey ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                disabled={!contrato.GEMINI_API_KEY}
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.GEMINI_API_KEY, 'Gemini API Key')}
                disabled={!contrato.GEMINI_API_KEY}
              >
                {copiedField === 'Gemini API Key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {!contrato.GEMINI_API_KEY && (
            <p className="text-sm text-muted-foreground">
              ⚠️ Nenhuma chave API configurada. Entre em contato com o suporte para configurar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
