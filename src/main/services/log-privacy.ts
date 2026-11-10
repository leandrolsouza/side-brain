/** Strip common credential forms from diagnostic messages. Payloads should not be logged. */
export function redactLogText(value: string): string {
  return value
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]+/gi, '$1 [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
    .replace(
      /(["']?[\w.-]*(?:key|token|secret|password|authorization)[\w.-]*["']?\s*[:=]\s*)["'][^"']*["']/gi,
      '$1"[REDACTED]"'
    )
    .replace(/\b([\w.-]*(?:key|token|secret|password|authorization)[\w.-]*)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/([?&][^=&#\s]+)=([^&#\s]+)/g, '$1=[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED]')
}
