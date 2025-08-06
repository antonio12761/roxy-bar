"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { nanoid } from "nanoid";

// Schema di validazione per cliente
const ClienteSchema = z.object({
  nome: z.string().min(1, "Nome richiesto"),
  cognome: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  codiceFiscale: z.string().optional(),
  partitaIva: z.string().optional(),
  indirizzo: z.string().optional(),
  citta: z.string().optional(),
  cap: z.string().optional(),
  provincia: z.string().optional(),
  dataNascita: z.string().optional(),
  tags: z.array(z.string()).optional(),
  preferenze: z.record(z.any()).optional(),
  note: z.string().optional(),
  attivo: z.boolean().default(true),
});

// Tipo per la creazione/modifica cliente
export type ClienteInput = z.infer<typeof ClienteSchema>;

// Tipo per la risposta delle actions
export type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Ottieni lista clienti con filtri e paginazione
export async function getClienti(
  page: number = 1,
  limit: number = 20,
  search?: string,
  filters?: {
    attivo?: boolean;
    tags?: string[];
    conDebiti?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const skip = (page - 1) * limit;

    // Costruisci where clause
    const where: any = {
      tenantId: user.tenantId,
    };

    if (filters?.attivo !== undefined) {
      where.attivo = filters.attivo;
    }

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { cognome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { telefono: { contains: search } },
        { codiceFiscale: { contains: search, mode: "insensitive" } },
        { partitaIva: { contains: search } },
      ];
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Query clienti con statistiche
    const [clienti, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              Ordinazione: true,
              Debiti: true,
              Pagamento: true,
            },
          },
          Debiti: {
            where: { stato: "APERTO" },
            select: {
              importo: true,
            },
          },
          Ordinazione: {
            select: {
              totale: true,
              stato: true,
            },
            take: 100,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.cliente.count({ where }),
    ]);

    // Calcola statistiche per ogni cliente
    const clientiConStats = clienti.map((cliente) => {
      const totaleSpeso = (cliente as any).Ordinazione
        .filter((o: any) => o.stato === "PAGATO")
        .reduce((sum: number, o: any) => sum + (o.totale?.toNumber() || 0), 0);

      const debitoTotale = (cliente as any).Debiti?.reduce(
        (sum: number, d: any) => sum + (d.importo?.toNumber() || 0),
        0
      ) || 0;

      return {
        ...cliente,
        stats: {
          ordiniTotali: (cliente as any)._count?.Ordinazione || 0,
          debitiAperti: (cliente as any).Debiti?.length || 0,
          debitoTotale,
          totaleSpeso,
          mediaSpesa: (cliente as any)._count?.Ordinazione > 0 
            ? totaleSpeso / (cliente as any)._count.Ordinazione 
            : 0,
        },
      };
    });

    return {
      success: true,
      data: {
        clienti: clientiConStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error("Errore getClienti:", error);
    return { success: false, error: "Errore nel recupero clienti" };
  }
}

// Ottieni dettaglio singolo cliente
export async function getCliente(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const cliente = await prisma.cliente.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        Ordinazione: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            Tavolo: true,
            User: {
              select: {
                username: true,
                nome: true,
              },
            },
          },
        },
        Debiti: {
          orderBy: { dataCreazione: "desc" },
          include: {
            Operatore: {
              select: {
                username: true,
                nome: true,
              },
            },
          },
        },
        Pagamento: {
          orderBy: { timestamp: "desc" },
          take: 50,
        },
        ContoScalare: {
          where: { stato: "APERTO" },
        },
      },
    });

    if (!cliente) {
      return { success: false, error: "Cliente non trovato" };
    }

    // Calcola statistiche dettagliate
    const stats = {
      ordiniTotali: (cliente as any).Ordinazione.length,
      ordiniInCorso: (cliente as any).Ordinazione.filter(
        (o: any) => ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(o.stato)
      ).length,
      ordiniCompletati: (cliente as any).Ordinazione.filter(
        (o: any) => o.stato === "PAGATO"
      ).length,
      totaleSpeso: (cliente as any).Ordinazione
        .filter((o: any) => o.stato === "PAGATO")
        .reduce((sum: number, o: any) => sum + (o.totale?.toNumber() || 0), 0),
      debitiTotali: (cliente as any).Debiti?.length || 0,
      debitiAperti: (cliente as any).Debiti?.filter((d: any) => d.stato === "APERTO").length || 0,
      debitoTotale: (cliente as any).Debiti
        .filter((d: any) => d.stato === "APERTO")
        .reduce((sum: number, d: any) => sum + (d.importo?.toNumber() || 0), 0),
      contiScalariAperti: (cliente as any).ContoScalare.length,
    };

    return {
      success: true,
      data: {
        ...cliente,
        stats,
      },
    };
  } catch (error) {
    console.error("Errore getCliente:", error);
    return { success: false, error: "Errore nel recupero cliente" };
  }
}

// Crea nuovo cliente
export async function createCliente(data: ClienteInput): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    // Valida input
    const validatedData = ClienteSchema.parse(data);

    // Verifica unicità email se fornita
    if (validatedData.email) {
      const existingEmail = await prisma.cliente.findFirst({
        where: {
          email: validatedData.email,
          tenantId: user.tenantId,
        },
      });

      if (existingEmail) {
        return { success: false, error: "Email già registrata" };
      }
    }

    // Crea cliente
    const cliente = await prisma.cliente.create({
      data: {
        id: nanoid(),
        ...validatedData,
        dataNascita: validatedData.dataNascita 
          ? new Date(validatedData.dataNascita) 
          : undefined,
        tenantId: user.tenantId,
      },
    });

    revalidatePath("/dashboard/clienti");

    return {
      success: true,
      data: cliente,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors[0]?.message || "Dati non validi" 
      };
    }
    console.error("Errore createCliente:", error);
    return { success: false, error: "Errore nella creazione cliente" };
  }
}

// Aggiorna cliente esistente
export async function updateCliente(
  id: string,
  data: Partial<ClienteInput>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    // Verifica che il cliente esista e appartenga al tenant
    const existingCliente = await prisma.cliente.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingCliente) {
      return { success: false, error: "Cliente non trovato" };
    }

    // Valida input parziale
    const validatedData = ClienteSchema.partial().parse(data);

    // Verifica unicità email se cambiata
    if (validatedData.email && validatedData.email !== existingCliente.email) {
      const emailExists = await prisma.cliente.findFirst({
        where: {
          email: validatedData.email,
          tenantId: user.tenantId,
          NOT: { id },
        },
      });

      if (emailExists) {
        return { success: false, error: "Email già registrata" };
      }
    }

    // Aggiorna cliente
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...validatedData,
        dataNascita: validatedData.dataNascita 
          ? new Date(validatedData.dataNascita) 
          : undefined,
      },
    });

    revalidatePath("/dashboard/clienti");
    revalidatePath(`/dashboard/clienti/${id}`);

    return {
      success: true,
      data: cliente,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors[0]?.message || "Dati non validi" 
      };
    }
    console.error("Errore updateCliente:", error);
    return { success: false, error: "Errore nell'aggiornamento cliente" };
  }
}

// Elimina cliente (soft delete)
export async function deleteCliente(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    // Verifica che il cliente esista
    const cliente = await prisma.cliente.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            Ordinazione: true,
            Debiti: true,
          },
        },
      },
    });

    if (!cliente) {
      return { success: false, error: "Cliente non trovato" };
    }

    // Verifica che non abbia ordini o debiti aperti
    const ordiniAperti = await prisma.ordinazione.count({
      where: {
        clienteId: id,
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"],
        },
      },
    });

    const debitiAperti = await prisma.debito.count({
      where: {
        clienteId: id,
        stato: "APERTO",
      },
    });

    if (ordiniAperti > 0 || debitiAperti > 0) {
      return {
        success: false,
        error: "Impossibile eliminare cliente con ordini o debiti aperti",
      };
    }

    // Soft delete
    await prisma.cliente.update({
      where: { id },
      data: { attivo: false },
    });

    revalidatePath("/dashboard/clienti");

    return { success: true };
  } catch (error) {
    console.error("Errore deleteCliente:", error);
    return { success: false, error: "Errore nell'eliminazione cliente" };
  }
}

// Ricerca clienti per autocomplete (manteniamo per compatibilità)
export async function searchClientiAutocomplete(query: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato", clienti: [] };
    }

    if (!query || query.length < 1) {
      return { success: true, clienti: [] };
    }

    const clienti = await prisma.cliente.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { nome: { contains: query, mode: 'insensitive' as const } },
          { cognome: { contains: query, mode: 'insensitive' as const } },
          { telefono: { contains: query, mode: 'insensitive' as const } },
        ],
        attivo: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { nome: 'asc' }
      ],
      take: 8,
      select: {
        id: true,
        nome: true,
        cognome: true,
        telefono: true,
        email: true,
        tags: true,
        _count: {
          select: {
            Debiti: {
              where: { stato: "APERTO" },
            },
          },
        },
      }
    });

    return { 
      success: true, 
      clienti: clienti.map(c => ({
        ...c,
        telefono: c.telefono || undefined,
        email: c.email || undefined,
        hasDebiti: (c as any)._count?.Debiti > 0,
      }))
    };
  } catch (error) {
    console.error("Errore ricerca clienti autocomplete:", error);
    return { success: false, error: "Errore durante la ricerca", clienti: [] };
  }
}

// Ottieni clienti recenti (manteniamo per compatibilità)
export async function getClientiRecenti(tavoloId?: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato", clienti: [] };
    }

    let clienti;
    
    if (tavoloId) {
      clienti = await prisma.cliente.findMany({
        where: {
          tenantId: user.tenantId,
          Ordinazione: {
            some: {
              tavoloId: tavoloId
            }
          },
          attivo: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 5,
        select: {
          id: true,
          nome: true,
          cognome: true,
        }
      });
    } else {
      clienti = await prisma.cliente.findMany({
        where: {
          tenantId: user.tenantId,
          attivo: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 10,
        select: {
          id: true,
          nome: true,
          cognome: true,
        }
      });
    }

    return { success: true, clienti };
  } catch (error) {
    console.error("Errore recupero clienti recenti:", error);
    return { success: false, error: "Errore durante il recupero", clienti: [] };
  }
}

// Crea o ottieni cliente (manteniamo per compatibilità)
export async function getOrCreateCliente(nome: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Utente non autenticato", cliente: null };
    }

    let cliente = await prisma.cliente.findFirst({
      where: {
        tenantId: user.tenantId,
        nome: {
          equals: nome,
          mode: 'insensitive' as const
        },
        attivo: true
      }
    });

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          id: nanoid(),
          nome: nome.trim(),
          tenantId: user.tenantId,
          updatedAt: new Date(),
        }
      });
    }

    return { success: true, cliente };
  } catch (error) {
    console.error("Errore get or create cliente:", error);
    return { success: false, error: "Errore durante l'operazione", cliente: null };
  }
}

// Crea cliente semplice (manteniamo per compatibilità)
export async function creaCliente(data: {
  nome: string;
  telefono?: string;
  email?: string;
  note?: string;
}) {
  const result = await createCliente({
    nome: data.nome,
    telefono: data.telefono,
    email: data.email,
    note: data.note,
    attivo: true,
  });
  
  // Rinomina 'data' in 'cliente' per consistenza
  if (result.success && result.data) {
    return {
      ...result,
      cliente: result.data
    };
  }
  
  return result;
}

// Importa clienti da CSV/Excel
export async function importClienti(
  clienti: Omit<ClienteInput, "attivo">[]
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN"].includes(user.ruolo)) {
      return { success: false, error: "Non autorizzato" };
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const clienteData of clienti) {
      try {
        // Valida dati
        const validatedData = ClienteSchema.parse({
          ...clienteData,
          attivo: true,
        });

        // Verifica duplicati per email
        if (validatedData.email) {
          const exists = await prisma.cliente.findFirst({
            where: {
              email: validatedData.email,
              tenantId: user.tenantId,
            },
          });

          if (exists) {
            results.failed++;
            results.errors.push(
              `Cliente con email ${validatedData.email} già esistente`
            );
            continue;
          }
        }

        // Crea cliente
        await prisma.cliente.create({
          data: {
            id: nanoid(),
            ...validatedData,
            dataNascita: validatedData.dataNascita
              ? new Date(validatedData.dataNascita)
              : undefined,
            tenantId: user.tenantId,
          },
        });

        results.success++;
      } catch (error) {
        results.failed++;
        if (error instanceof z.ZodError) {
          results.errors.push(
            `Errore validazione: ${error.errors[0]?.message}`
          );
        } else {
          results.errors.push("Errore generico nell'importazione");
        }
      }
    }

    revalidatePath("/dashboard/clienti");

    return {
      success: results.failed === 0,
      data: results,
    };
  } catch (error) {
    console.error("Errore importClienti:", error);
    return { success: false, error: "Errore nell'importazione clienti" };
  }
}

// Esporta clienti in formato CSV/Excel
export async function exportClienti(filters?: {
  attivo?: boolean;
  tags?: string[];
  conDebiti?: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autorizzato" };
    }

    const where: any = {
      tenantId: user.tenantId,
    };

    if (filters?.attivo !== undefined) {
      where.attivo = filters.attivo;
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const clienti = await prisma.cliente.findMany({
      where,
      include: {
        _count: {
          select: {
            Ordinazione: true,
            Debiti: true,
          },
        },
        Debiti: {
          where: { stato: "APERTO" },
          select: {
            importo: true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    // Filtra per debiti se richiesto
    let exportData = clienti;
    if (filters?.conDebiti) {
      exportData = clienti.filter((c) => (c as any).Debiti?.length > 0);
    }

    // Formatta per export
    const formattedData = exportData.map((c) => ({
      Nome: c.nome,
      Cognome: c.cognome || "",
      Telefono: c.telefono || "",
      Email: c.email || "",
      "Codice Fiscale": c.codiceFiscale || "",
      "Partita IVA": c.partitaIva || "",
      Indirizzo: c.indirizzo || "",
      Città: c.citta || "",
      CAP: c.cap || "",
      Provincia: c.provincia || "",
      "Data Nascita": c.dataNascita
        ? new Date(c.dataNascita).toLocaleDateString("it-IT")
        : "",
      Tags: c.tags?.join(", ") || "",
      Note: c.note || "",
      "Ordini Totali": (c as any)._count?.Ordinazione || 0,
      "Debiti Aperti": (c as any).Debiti?.length || 0,
      "Debito Totale": ((c as any).Debiti?.reduce(
        (sum: number, d: any) => sum + (d.importo?.toNumber() || 0),
        0
      ) || 0).toFixed(2),
      Attivo: c.attivo ? "Sì" : "No",
      "Data Registrazione": new Date(c.createdAt).toLocaleDateString("it-IT"),
    }));

    return {
      success: true,
      data: formattedData,
    };
  } catch (error) {
    console.error("Errore exportClienti:", error);
    return { success: false, error: "Errore nell'esportazione clienti" };
  }
}