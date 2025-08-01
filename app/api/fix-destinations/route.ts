import { NextResponse } from "next/server";
import { fixBarDestinations } from "@/lib/actions/fix-bar-destinations";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function GET(request: Request) {
  try {
    // Verifica autorizzazione
    const user = await getCurrentUser();
    if (!user || (user.ruolo !== 'ADMIN' && user.ruolo !== 'SUPERVISORE')) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }
    
    console.log("🔧 Esecuzione fix destinazioni richiesta da:", user.nome);
    
    const result = await fixBarDestinations();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore nell'endpoint fix-destinations:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}