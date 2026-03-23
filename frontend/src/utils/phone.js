export const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  const hasLeadingPlus = trimmedValue.startsWith('+')
  const digitsOnly = trimmedValue.replace(/\D/g, '')

  if (!digitsOnly) {
    return ''
  }

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly
}
