import { renderOnePageReport } from "../render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Params are always a Promise in this Next version. The union that used to
// be here failed the generated route-type check the moment the dev server
// regenerated types for this route. Matches the sibling snapshot route.
type RouteContext = { params: Promise<{ assessmentId: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { assessmentId } = await ctx.params;
  return renderOnePageReport(req, assessmentId, "png");
}
