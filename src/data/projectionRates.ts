export interface ProjectionRate {
  zone: string
  moment: string
  vehicle: string
  grossMinPerHour: number
  grossMaxPerHour: number
}

/** Invented sample values for a reproducible demo; they are not Rappi forecasts. */
export const SIMULATED_PROJECTION_RATES: ProjectionRate[] = [
  { zone: 'Lima Centro', moment: 'Mañana', vehicle: 'Bicicleta', grossMinPerHour: 10, grossMaxPerHour: 17 },
  { zone: 'Lima Centro', moment: 'Tarde', vehicle: 'Bicicleta', grossMinPerHour: 12, grossMaxPerHour: 20 },
  { zone: 'Lima Centro', moment: 'Noche', vehicle: 'Bicicleta', grossMinPerHour: 11, grossMaxPerHour: 19 },
  { zone: 'Lima Centro', moment: 'Mañana', vehicle: 'Moto', grossMinPerHour: 14, grossMaxPerHour: 24 },
  { zone: 'Lima Centro', moment: 'Tarde', vehicle: 'Moto', grossMinPerHour: 17, grossMaxPerHour: 29 },
  { zone: 'Lima Centro', moment: 'Noche', vehicle: 'Moto', grossMinPerHour: 16, grossMaxPerHour: 28 },
  { zone: 'Miraflores', moment: 'Mañana', vehicle: 'Bicicleta', grossMinPerHour: 12, grossMaxPerHour: 20 },
  { zone: 'Miraflores', moment: 'Tarde', vehicle: 'Bicicleta', grossMinPerHour: 14, grossMaxPerHour: 23 },
  { zone: 'Miraflores', moment: 'Noche', vehicle: 'Bicicleta', grossMinPerHour: 13, grossMaxPerHour: 22 },
  { zone: 'Miraflores', moment: 'Mañana', vehicle: 'Moto', grossMinPerHour: 16, grossMaxPerHour: 27 },
  { zone: 'Miraflores', moment: 'Tarde', vehicle: 'Moto', grossMinPerHour: 19, grossMaxPerHour: 32 },
  { zone: 'Miraflores', moment: 'Noche', vehicle: 'Moto', grossMinPerHour: 18, grossMaxPerHour: 31 },
  { zone: 'Surco', moment: 'Mañana', vehicle: 'Bicicleta', grossMinPerHour: 10, grossMaxPerHour: 17 },
  { zone: 'Surco', moment: 'Tarde', vehicle: 'Bicicleta', grossMinPerHour: 12, grossMaxPerHour: 20 },
  { zone: 'Surco', moment: 'Noche', vehicle: 'Bicicleta', grossMinPerHour: 11, grossMaxPerHour: 19 },
  { zone: 'Surco', moment: 'Mañana', vehicle: 'Moto', grossMinPerHour: 14, grossMaxPerHour: 24 },
  { zone: 'Surco', moment: 'Tarde', vehicle: 'Moto', grossMinPerHour: 17, grossMaxPerHour: 29 },
  { zone: 'Surco', moment: 'Noche', vehicle: 'Moto', grossMinPerHour: 16, grossMaxPerHour: 28 },
  { zone: 'San Miguel', moment: 'Mañana', vehicle: 'Bicicleta', grossMinPerHour: 9, grossMaxPerHour: 16 },
  { zone: 'San Miguel', moment: 'Tarde', vehicle: 'Bicicleta', grossMinPerHour: 11, grossMaxPerHour: 19 },
  { zone: 'San Miguel', moment: 'Noche', vehicle: 'Bicicleta', grossMinPerHour: 10, grossMaxPerHour: 18 },
  { zone: 'San Miguel', moment: 'Mañana', vehicle: 'Moto', grossMinPerHour: 13, grossMaxPerHour: 23 },
  { zone: 'San Miguel', moment: 'Tarde', vehicle: 'Moto', grossMinPerHour: 16, grossMaxPerHour: 28 },
  { zone: 'San Miguel', moment: 'Noche', vehicle: 'Moto', grossMinPerHour: 15, grossMaxPerHour: 27 },
  { zone: 'Jesús María', moment: 'Mañana', vehicle: 'Bicicleta', grossMinPerHour: 10, grossMaxPerHour: 17 },
  { zone: 'Jesús María', moment: 'Tarde', vehicle: 'Bicicleta', grossMinPerHour: 12, grossMaxPerHour: 20 },
  { zone: 'Jesús María', moment: 'Noche', vehicle: 'Bicicleta', grossMinPerHour: 11, grossMaxPerHour: 19 },
  { zone: 'Jesús María', moment: 'Mañana', vehicle: 'Moto', grossMinPerHour: 14, grossMaxPerHour: 24 },
  { zone: 'Jesús María', moment: 'Tarde', vehicle: 'Moto', grossMinPerHour: 17, grossMaxPerHour: 29 },
  { zone: 'Jesús María', moment: 'Noche', vehicle: 'Moto', grossMinPerHour: 16, grossMaxPerHour: 28 },
]
