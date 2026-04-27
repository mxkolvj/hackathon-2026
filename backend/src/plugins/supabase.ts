import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient | null;
  }
}

export default fp(async (app) => {
  const client =
    config.supabaseUrl && config.supabaseKey
      ? createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } })
      : null;
  if (!client) {
    app.log.warn('supabase not configured — votes endpoints will return empty data');
  } else {
    const { error } = await client.from('votes').select('*', { head: true, count: 'exact' });
    if (error) {
      app.log.error(
        { err: error },
        'supabase reachable but votes table query failed — apply backend/supabase/schema.sql or check that SUPABASE_KEY is the service_role key',
      );
    } else {
      app.log.info('supabase connected — votes table reachable');
    }
  }
  app.decorate('supabase', client);
});
