import { z } from "zod";
import { NextResponse } from "next/server";

type ValidationSuccess<T> = { data: T; error: null };
type ValidationFailure = { data: null; error: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Parses and validates a request body against a Zod schema.
 * Returns typed data on success, or a pre-built NextResponse error on failure.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: "Validación fallida",
          details: result.error.flatten(),
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}
