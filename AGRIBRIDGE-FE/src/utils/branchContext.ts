export type BranchContext = {
  branchId: string
  branchName: string
}

export function getBranchContextFromSearchParams(params: URLSearchParams): BranchContext | null {
  const branchId = params.get('branchId') || ''
  const branchName = params.get('branchName') || ''
  if (!branchId && !branchName) return null
  return { branchId, branchName }
}

export function buildBranchScopedPath(path: string, branch: BranchContext | null) {
  if (!branch?.branchId && !branch?.branchName) return path
  const params = new URLSearchParams()
  if (branch.branchId) params.set('branchId', branch.branchId)
  if (branch.branchName) params.set('branchName', branch.branchName)
  return `${path}?${params.toString()}`
}

export function buildBranchContextForUrl(branch: { rawId: number; name: string }): BranchContext {
  return {
    branchId: String(branch.rawId),
    branchName: branch.name,
  }
}

export function normalizeBranchText(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

export function matchesBranchContext(
  item: { branchId?: number | string | null; branch?: string | null; branchName?: string | null },
  branch: BranchContext | null,
) {
  if (!branch?.branchId && !branch?.branchName) return true
  if (branch.branchId && String(item.branchId ?? '') === branch.branchId) return true
  const expected = normalizeBranchText(branch.branchName)
  if (!expected) return false
  return normalizeBranchText(item.branch || item.branchName).includes(expected)
}
