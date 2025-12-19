"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  initialDate?: Date
  avoidWeekends?: boolean
  avoidHolidays?: boolean
  daysFromNow?: number
}

// Lista de feriados nacionais fixos (formato MM-DD)
const HOLIDAYS = [
  "01-01", // Ano Novo
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "12-25", // Natal
]

export function DateInput({
  value,
  onChange,
  className,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  autoFocus = false,
  initialDate,
  avoidWeekends = true,
  avoidHolidays = true,
  daysFromNow = 0,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState(value || "")

  // Função para formatar a data no formato DD/MM/AAAA
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Função para verificar se uma data é fim de semana
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6 // 0 = domingo, 6 = sábado
  }

  // Função para verificar se uma data é feriado
  const isHoliday = (date: Date): boolean => {
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    const dateString = `${month}-${day}`
    return HOLIDAYS.includes(dateString)
  }

  // Função para ajustar a data para evitar fins de semana e feriados
  const adjustDate = (date: Date): Date => {
    const adjustedDate = new Date(date)
    let attempts = 0
    const maxAttempts = 10 // Limite para evitar loop infinito

    while (
      ((avoidWeekends && isWeekend(adjustedDate)) || (avoidHolidays && isHoliday(adjustedDate))) &&
      attempts < maxAttempts
    ) {
      // Avançar para o próximo dia útil
      adjustedDate.setDate(adjustedDate.getDate() + 1)
      attempts++
    }

    return adjustedDate
  }

  // Inicializar com a data apropriada quando o componente montar
  useEffect(() => {
    if (initialDate || daysFromNow > 0) {
      let date = initialDate ? new Date(initialDate) : new Date()

      // Adicionar dias se necessário
      if (daysFromNow > 0) {
        date.setDate(date.getDate() + daysFromNow)
      }

      // Ajustar para evitar fins de semana e feriados
      date = adjustDate(date)

      // Formatar e definir o valor
      const formattedDate = formatDate(date)
      setInputValue(formattedDate)
      onChange(formattedDate)
    } else if (value) {
      setInputValue(value)
    }
  }, [initialDate, daysFromNow])

  // Aplicar máscara de data
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value

    // Remover caracteres não numéricos
    input = input.replace(/\D/g, "")

    // Aplicar máscara
    if (input.length > 0) {
      input = input.substring(0, 8)

      if (input.length > 4) {
        input = `${input.substring(0, 2)}/${input.substring(2, 4)}/${input.substring(4)}`
      } else if (input.length > 2) {
        input = `${input.substring(0, 2)}/${input.substring(2)}`
      }
    }

    setInputValue(input)
    onChange(input)
  }

  // Posicionar o cursor na primeira posição ao focar
  const handleFocus = () => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.setSelectionRange(0, 0)
      }, 10)
    }
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
      autoFocus={autoFocus}
      maxLength={10}
    />
  )
}
