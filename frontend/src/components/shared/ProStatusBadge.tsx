import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { ProStatus } from '@/types/api'
import { proStatusLabelKey } from '@/lib/constants'

const VARIANT: Record<ProStatus, 'secondary' | 'outline'> = {
  NON_CLASSE: 'outline',
  PERSO: 'secondary',
  PRO_A_REMBOURSER: 'secondary',
  PRO_ABSORBE: 'secondary',
}

interface ProStatusBadgeProps {
  status: ProStatus
  className?: string
}

export function ProStatusBadge({ status, className }: ProStatusBadgeProps) {
  const { t } = useTranslation()
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {t(proStatusLabelKey(status))}
    </Badge>
  )
}
