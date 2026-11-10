import type { MeetingModeProps } from './meeting/meeting-types'
import { useMeetingController } from './meeting/useMeetingController'
import { MeetingSetup } from './meeting/MeetingSetup'
import { MeetingActive } from './meeting/MeetingActive'
import { MeetingReview } from './meeting/MeetingReview'
import { MeetingSelection } from './meeting/MeetingSelection'
import { MeetingSaved } from './meeting/MeetingSaved'

export function MeetingMode(props: MeetingModeProps) {
  const state = useMeetingController(props)
  switch (state.step) {
    case 'setup':
      return <MeetingSetup state={state} />
    case 'active':
      return <MeetingActive state={state} />
    case 'review':
      return <MeetingReview state={state} />
    case 'select':
      return <MeetingSelection state={state} />
    case 'saved':
      return <MeetingSaved state={state} />
    default:
      return null
  }
}
