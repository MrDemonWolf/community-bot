import { NextResponse } from "next/server";
import { db, sql } from "@community-bot/db";

export async function GET() {
	const start = Date.now();
	try {
		await db.execute(sql`SELECT 1`);
		const latencyMs = Date.now() - start;
		return NextResponse.json({
			status: "healthy",
			database: "up",
			latency_ms: latencyMs,
		});
	} catch {
		return NextResponse.json(
			{
				status: "unhealthy",
				database: "down",
			},
			{ status: 503 }
		);
	}
}
