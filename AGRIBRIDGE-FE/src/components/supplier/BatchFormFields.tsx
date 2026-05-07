import { ExternalLink, Loader2, Upload, Video } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { resolveUploadedFileUrl } from '../../services/uploadService'

export type BatchFormState = {
  harvestDate: string
  expiryDate: string
  grade: 'A' | 'B' | 'C' | ''
  size: string
  quantity: string
  price: string
  moq: string
  storageTempValue: string
  videoUrl: string
  imageUrls: string[]
  qcResult: 'PASS' | 'FAIL' | ''
  qcDocumentUrl: string
  qcNotes: string
}

export const EMPTY_BATCH_FORM: BatchFormState = {
  harvestDate: '',
  expiryDate: '',
  grade: '',
  size: '',
  quantity: '',
  price: '',
  moq: '',
  storageTempValue: '',
  videoUrl: '',
  imageUrls: [],
  qcResult: '',
  qcDocumentUrl: '',
  qcNotes: '',
}

type BatchFormFieldsProps = {
  form: BatchFormState
  setForm: Dispatch<SetStateAction<BatchFormState>>
  unit: string
  uploadingQcFile: boolean
  uploadingVideo: boolean
  uploadingBatchImage?: boolean
  onUploadQc: (file: File) => void
  onUploadVideo: (file: File) => void
  onUploadBatchImage?: (file: File) => void
  showBatchImages?: boolean
  disableExpiryDate?: boolean
  expiryDateDisabledMessage?: string
}

export function BatchFormFields({
  form,
  setForm,
  unit,
  uploadingQcFile,
  uploadingVideo,
  uploadingBatchImage = false,
  onUploadQc,
  onUploadVideo,
  onUploadBatchImage,
  showBatchImages = false,
  disableExpiryDate = false,
  expiryDateDisabledMessage,
}: BatchFormFieldsProps) {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid gap-2 md:grid-cols-2">
        <Field
          label={"Ng\u00e0y thu ho\u1ea1ch/\u0111\u00e1nh b\u1eaft"}
          type="date"
          value={form.harvestDate}
          onChange={(value) => setForm((prev) => ({ ...prev, harvestDate: value }))}
          required
        />
        <Field
          label={"Ng\u00e0y h\u1ebft h\u1ea1n"}
          type="date"
          value={form.expiryDate}
          onChange={(value) => setForm((prev) => ({ ...prev, expiryDate: value }))}
          disabled={disableExpiryDate}
          hint={disableExpiryDate ? expiryDateDisabledMessage : undefined}
          required
        />
        <FieldSelect
          label="Grade"
          value={form.grade}
          onChange={(value) => setForm((prev) => ({ ...prev, grade: value as 'A' | 'B' | 'C' | '' }))}
          required
          options={[
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
          ]}
        />
        <Field label="Size" value={form.size} onChange={(value) => setForm((prev) => ({ ...prev, size: value }))} />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Field
          label={`T\u1ed3n kho (${unit})`}
          type="number"
          value={form.quantity}
          onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))}
          required
        />
        <Field
          label={"Gi\u00e1"}
          type="number"
          value={form.price}
          onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
          required
        />
        <Field label={`MOQ (${unit})`} type="number" value={form.moq} onChange={(value) => setForm((prev) => ({ ...prev, moq: value }))} />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Field
          label={"Nhi\u1ec7t \u0111\u1ed9 b\u1ea3o qu\u1ea3n (\u00b0C)"}
          type="number"
          value={form.storageTempValue}
          onChange={(value) => setForm((prev) => ({ ...prev, storageTempValue: value }))}
        />

        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{"Video l\u00f4 h\u00e0ng"}</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px]">
              {uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />} Upload
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUploadVideo(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            {form.videoUrl ? (
              <a href={form.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700">
                <ExternalLink className="h-3 w-3" /> Link
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {showBatchImages ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{"H\u00ecnh \u1ea3nh l\u00f4 h\u00e0ng"}</p>
          <div className="flex flex-wrap items-center gap-2">
            {form.imageUrls.map((url) => {
              const previewUrl = resolveUploadedFileUrl(url)
              return (
                <div key={url} className="relative h-16 w-16 overflow-hidden rounded border border-slate-200">
                  <img
                    src={previewUrl || 'https://placehold.co/128x128?text=No+Image'}
                    alt="batch-preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[10px]"
                    onClick={() => setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((item) => item !== url) }))}
                  >
                    x
                  </button>
                </div>
              )
            })}
            <label className="inline-flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              {uploadingBatchImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file && onUploadBatchImage) onUploadBatchImage(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-emerald-200 p-2">
        <p className="mb-2 text-[11px] font-semibold text-emerald-900">{"Ki\u1ec3m \u0111\u1ecbnh l\u00f4 h\u00e0ng (QC)"}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-700">{"K\u1ebft qu\u1ea3"}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded border px-2 py-1 ${form.qcResult === 'PASS' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300'}`}
                onClick={() => setForm((prev) => ({ ...prev, qcResult: 'PASS' }))}
              >
                PASS
              </button>
              <button
                type="button"
                className={`rounded border px-2 py-1 ${form.qcResult === 'FAIL' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300'}`}
                onClick={() => setForm((prev) => ({ ...prev, qcResult: 'FAIL' }))}
              >
                FAIL
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-700">{"File ki\u1ec3m \u0111\u1ecbnh"}</p>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px]">
              {uploadingQcFile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Upload
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUploadQc(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            {form.qcDocumentUrl ? <p className="truncate text-[10px] text-emerald-700">{form.qcDocumentUrl}</p> : null}
          </div>
        </div>

        <FieldTextArea
          label={"Ghi ch\u00fa ki\u1ec3m \u0111\u1ecbnh"}
          value={form.qcNotes}
          onChange={(value) => setForm((prev) => ({ ...prev, qcNotes: value }))}
        />
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  disabled,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        disabled={disabled}
        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
      {hint ? <span className="mt-1 block text-[10px] font-medium text-amber-700">{hint}</span> : null}
    </label>
  )
}

function FieldTextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-[12px]"
      />
    </label>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
      >
        <option value="">{"-- Ch\u1ecdn --"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
