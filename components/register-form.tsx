"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { SplashScreen } from "./splash-screen"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useIsMobile } from "@/hooks/use-mobile"
import { ArrowLeft } from "lucide-react"

export default function RegisterForm() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSplash, setShowSplash] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'name') {
      setName(value);
    } else if (name === 'email') {
      setEmail(value);
    } else if (name === 'password') {
      setPassword(value);
    } else if (name === 'confirmPassword') {
      setConfirmPassword(value);
    }
    setError("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setIsSubmitting(true)

    const payload = {
      idEmpresa: 1,
      nome: name,
      email: email,
      senha: password,
      funcao: 'Vendedor'
    };

    console.log('📤 Enviando dados para registro:', {
      ...payload,
      senha: '***'
    });

    try {
      const response = await fetch('/api/usuarios/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao realizar cadastro')
      }

      // Redirecionar para a página de login
      alert("Cadastro realizado com sucesso! Aguarde a aprovação do administrador para fazer login.")
      router.push("/")
    } catch (err: any) {
      setError(err.message || "Erro ao realizar cadastro. Tente novamente.")
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mobile Layout
  if (isMobile) {
    if (showSplash) {
      return <SplashScreen onFinish={() => setShowSplash(false)} duration={2000} />
    }
    return (
      <div className="min-h-screen bg-[#24292E] w-full">
        <div className="h-screen flex flex-col items-center justify-center p-6">
          {/* Logo Mobile */}
          <div className="mb-8">
            <div className="relative w-64 h-32 mx-auto">
              <Image
                src="/logo-mobile.png"
                alt="PredictSales Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-xl font-bold font-montserrat text-white mb-8">Crie sua conta</h1>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm font-bold font-montserrat text-gray-300">Nome</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Nome"
                value={name}
                onChange={handleChange}
                className="h-11 bg-gray-50/10 border-gray-700 rounded-lg text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm font-bold font-montserrat text-gray-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={handleChange}
                className="h-11 bg-gray-50/10 border-gray-700 rounded-lg text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm font-bold font-montserrat text-gray-300">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Senha"
                value={password}
                onChange={handleChange}
                className="h-11 bg-gray-50/10 border-gray-700 rounded-lg text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-sm font-bold font-montserrat text-gray-300">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChange={handleChange}
                className="h-11 bg-gray-50/10 border-gray-700 rounded-lg text-white"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 font-bold">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg font-bold font-montserrat text-white"
              style={{ backgroundColor: '#2ECC71' }}
            >
              {isSubmitting ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </form>

          {/* Link para login */}
          <div className="mt-8 text-center text-sm">
            <span className="text-gray-400">Já tem uma conta? </span>
            <Link href="/" className="font-bold" style={{ color: '#2ECC71' }}>
              Entrar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Desktop Layout (original)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} duration={2000} />
  }
  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-8 border-none">
      <div className="flex flex-col items-center mb-6">
        <div className="mb-2 w-full">
          <div className="relative w-full h-32 mx-auto">
            <Image
              src="/logo-register.png"
              alt="PredictSales Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        <p className="text-center text-muted-foreground text-sm font-roboto">
          Aumente seu desempenho comercial com IA
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-bold font-montserrat text-[#24292E]">
            Nome Completo
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={handleChange}
            className="bg-background border-gray-200 rounded-lg h-10"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-bold font-montserrat text-[#24292E]">
            E-mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={handleChange}
            className="bg-background border-gray-200 rounded-lg h-10"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-bold font-montserrat text-[#24292E]">
            Senha
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={handleChange}
            className="bg-background border-gray-200 rounded-lg h-10"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-bold font-montserrat text-[#24292E]">
            Confirmar Senha
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={handleChange}
            className="bg-background border-gray-200 rounded-lg h-10"
            required
          />
        </div>

        {error && <p className="text-sm text-red-500 font-bold">{error}</p>}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#2ECC71] hover:bg-[#27ae60] text-white font-bold font-montserrat h-11 rounded-lg shadow-md transition-all uppercase tracking-wide"
        >
          {isSubmitting ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/" className="text-[#2ECC71] font-bold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}