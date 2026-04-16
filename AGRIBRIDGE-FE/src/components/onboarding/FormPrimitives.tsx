import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

type FormFieldProps = {
  label: string
  placeholder: string
  type?: string
  required?: boolean
}

type SelectFieldProps = {
  label: string
  placeholder: string
  required?: boolean
}

type DropzoneFieldProps = {
  label: string
  title: string
  hint: string
  icon: LucideIcon
  required?: boolean
}

type FormActionsProps = {
  backTo: string
  nextTo: string
  nextLabel?: string
}

const labelClass = 'mb-2 block text-sm font-semibold text-[#1F2937]'
const inputClass =
  'h-12 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-4 text-[15px] text-[#0F172A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#2F8F3A] focus:bg-white'

export function FormField({ label, placeholder, type = 'text', required = false }: FormFieldProps) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
      </label>
      <input type={type} placeholder={placeholder} className={inputClass} />
    </div>
  )
}

export function SelectField({ label, placeholder, required = false }: SelectFieldProps) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
      </label>
      <div className="relative">
        <select className={`${inputClass} appearance-none`} defaultValue="">
          <option value="" disabled>
            {placeholder}
          </option>
          <option value="llc">Công ty TNHH</option>
          <option value="jsc">Công ty Cổ phần</option>
          <option value="household">Hộ kinh doanh</option>
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#667085]">▾</span>
      </div>
    </div>
  )
}

export function DropzoneField({ label, title, hint, icon: Icon, required = false }: DropzoneFieldProps) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
      </label>
      <button
        type="button"
        className="flex h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D9E1EA] bg-[#F8FAFC] text-center transition hover:bg-white"
      >
        <Icon className="h-6 w-6 text-[#98A2B3]" />
        <span className="mt-2 text-sm font-semibold text-[#475467]">{title}</span>
        <span className="mt-1 text-xs text-[#98A2B3]">{hint}</span>
      </button>
    </div>
  )
}

export function FormActions({ backTo, nextTo, nextLabel = 'Lưu và tiếp tục' }: FormActionsProps) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-[#E6ECF2] pt-8">
      <Link to={backTo} className="inline-flex items-center gap-2 font-semibold text-[#344054] hover:text-[#0F172A]">
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      <Link
        to={nextTo}
        className="inline-flex min-w-52 items-center justify-center gap-2 rounded-lg bg-[#2F8F3A] px-6 py-3 font-semibold text-white transition hover:bg-[#277A31]"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
