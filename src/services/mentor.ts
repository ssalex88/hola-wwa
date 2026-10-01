import type { MentorService } from '../contracts/mentor.ts'
import { localMentorService } from './mentor.local.ts'

// Integration selects one implementation here. The mock remains owned by A.
export const mentorService: MentorService = localMentorService
export type * from '../contracts/mentor.ts'
