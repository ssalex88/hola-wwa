/** Punto de entrada para A. B-01 expone consultas; las acciones llegarán por entrega. */
export { localMentorProfileService as mentorService } from './mentor.local.ts'
export type { MentorProfileService, ProfileSnapshot, ServiceResult } from '../contracts/mentor.ts'
