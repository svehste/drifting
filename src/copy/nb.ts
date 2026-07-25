/**
 * Single source of Norwegian UI copy [tekst]. Keep every user-facing string here
 * so wording stays consistent. English terms live in code comments per the spec
 * convention, e.g. Event [Arrangement].
 */
export const nb = {
  appName: "Driftingarrangement",
  tagline: "Kvalifisering, cup og live resultattavle",

  nav: {
    events: "Arrangementer",
    races: "Løp",
    classes: "Klasser",
    users: "Brukere",
    drivers: "Førere",
    auditLog: "Logg",
    signOut: "Logg ut",
    signIn: "Logg inn",
  },

  roles: {
    admin: "Admin",
    judge: "Dommer",
    secretary: "Sekretær",
    driver: "Fører",
  },

  raceStatus: {
    registration: "Påmelding",
    qualifying: "Kvalifisering",
    cup: "Cup",
    finished: "Ferdig",
  },

  eventStatus: {
    upcoming: "Kommende",
    ongoing: "Pågår",
    finished: "Ferdig",
  },

  criterion: {
    line: "Linje",
    angle: "Vinkel",
    style: "Stil",
    flow: "Flyt",
    effort: "Innsats",
  },

  round: {
    top32: "Topp 32",
    top16: "Topp 16",
    quarterfinal: "Kvartfinale",
    semifinal: "Semifinale",
    final: "Finale",
    bronsefinal: "Bronsefinale",
  },

  leaderboard: {
    title: "Resultatliste",
    rank: "Plass",
    startNumber: "Startnr.",
    name: "Navn",
    club: "Klubb",
    car: "Bil",
    run: "Runde",
    best: "Beste",
    inProgress: "Kvalifisering pågår",
    unofficial: "Uoffisiell",
    official: "Offisiell",
    notApproved: "Ikke godkjent",
    bye: "Oversitter",
  },

  actions: {
    create: "Opprett",
    edit: "Rediger",
    delete: "Slett",
    save: "Lagre",
    cancel: "Avbryt",
    confirm: "Bekreft",
    lock: "Lås kvalifisering",
    unlock: "Lås opp kvalifisering",
    publish: "Gjør offisiell",
    generateBracket: "Generer stige",
    regenerateBracket: "Regenerer stige",
    invite: "Inviter",
    omt: "Omkjøring (OMT)",
  },

  errors: {
    unauthorized: "Du har ikke tilgang til denne handlingen.",
    notFound: "Fant ikke det du lette etter.",
    deleteBlockedResults:
      "Kan ikke slette: det finnes resultater (kvalifiseringspoeng eller battle-utfall).",
    invalidInput: "Ugyldige data. Sjekk feltene og prøv igjen.",
    generic: "Noe gikk galt. Prøv igjen.",
  },

  usersForm: {
    staffSection: "Innlogging (admin/dommer/sekretær)",
    password: "Passord",
    passwordHint: "Minst 8 tegn. La stå tomt for å beholde eksisterende passord.",
    driverSection: "Førerdetaljer",
    passwordError: "Kunne ikke lagre passordet. Sjekk e-post og prøv igjen.",
  },

  driverPage: {
    contact: "Kontaktinfo",
    upcoming: "Kommende løp",
    history: "Tidligere løp",
    qualifyingResult: "Kvalifisering",
    cupResult: "Cup",
    phone: "Telefon",
    email: "E-post",
    dummyTag: "dummynr.",
    noUpcoming: "Ingen kommende løp.",
    noHistory: "Ingen tidligere løp.",
  },
} as const;

export type Nb = typeof nb;
