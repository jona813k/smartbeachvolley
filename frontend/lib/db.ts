import { neon } from '@neondatabase/serverless'

// Lazy singleton — neon() is deferred to first call so the build doesn't fail
// when POSTGRES_DATABASE_URL isn't available at bundle time.
let _sql: ReturnType<typeof neon> | undefined

export const sql = (
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<Record<string, any>[]> => {
  if (!_sql) _sql = neon(process.env.POSTGRES_DATABASE_URL!)
  return _sql(strings, ...values) as Promise<Record<string, any>[]>
}
