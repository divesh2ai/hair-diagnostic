import { renderOnePageReport } from "../render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: { assessmentId: string } | Promise<{ assessmentId: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { assessmentId } = await Promise.resolve(ctx.params);
  return renderOnePageReport(req, assessmentId, "png");
}
