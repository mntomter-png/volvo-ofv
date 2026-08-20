import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import { getUserBrand } from "@/lib/brand/user-brand";
import { buildPresentationPptxBuffer } from "@/lib/presentation/export-pptx";
import { getPresentationDeckData } from "@/lib/presentation/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiPageAccess("presentasjon");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "presentation-pptx",
    });
    if (limited) return limited;

    const brand = getUserBrand(user);
    const data = await getPresentationDeckData(brand.makeName);
    const { buffer, filename } = await buildPresentationPptxBuffer(data);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
