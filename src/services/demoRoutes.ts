import type { DemoProfile } from '../data/demoProfiles'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'demo-controls' }
  | { kind: 'operations' }
  | { kind: 'messages' }
  | { kind: 'support' }
  | { kind: 'invitation'; profileId: string }
  | { kind: 'invitation-preview'; profileId: string }
  | { kind: 'program'; profileId: string }
  | { kind: 'connection'; profileId: string }
  | { kind: 'invalid-invitation' }

export function invitationTokenFor(profileId: string): string {
  return `pilot-demo-${profileId}`
}

export function parseAppRoute(search: string, profiles: DemoProfile[]): AppRoute {
  const params = new URLSearchParams(search)
  if (params.get('operations') === 'pilot') return { kind: 'operations' }
  if (params.get('settings') === 'messages') return { kind: 'messages' }
  if (params.get('help') === 'support') return { kind: 'support' }
  if (params.get('demo') === 'controls') return { kind: 'demo-controls' }
  if (params.has('preview-invite')) {
    const profileId = params.get('preview-invite')
    return profiles.some(profile => profile.id === profileId) ? { kind: 'invitation-preview', profileId: profileId as string } : { kind: 'invalid-invitation' }
  }
  if (params.has('invite')) {
    const token = params.get('invite')
    const match = profiles.find((profile) => token === invitationTokenFor(profile.id))
    return match ? { kind: 'invitation', profileId: match.id } : { kind: 'invalid-invitation' }
  }
  if (params.has('connect')) {
    const profileId = params.get('connect')
    return profiles.some(profile => profile.id === profileId) ? { kind: 'connection', profileId: profileId as string } : { kind: 'invalid-invitation' }
  }
  if (params.has('program')) {
    const profileId = params.get('program')
    return profiles.some((profile) => profile.id === profileId)
      ? { kind: 'program', profileId: profileId as string }
      : { kind: 'invalid-invitation' }
  }
  return { kind: 'home' }
}

export function routeHref(route: AppRoute, pathname: string): string {
  const params = new URLSearchParams()
  if (route.kind === 'demo-controls') params.set('demo', 'controls')
  if (route.kind === 'operations') params.set('operations', 'pilot')
  if (route.kind === 'messages') params.set('settings', 'messages')
  if (route.kind === 'support') params.set('help', 'support')
  if (route.kind === 'invitation') params.set('invite', invitationTokenFor(route.profileId))
  if (route.kind === 'invitation-preview') params.set('preview-invite', route.profileId)
  if (route.kind === 'connection') params.set('connect', route.profileId)
  if (route.kind === 'program') params.set('program', route.profileId)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
