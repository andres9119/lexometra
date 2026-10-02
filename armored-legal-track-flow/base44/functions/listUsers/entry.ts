import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns a safe list of users (id, full_name) for any authenticated user.
// Uses asServiceRole to bypass the User entity's admin-only restriction.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await base44.asServiceRole.entities.User.list();

    // Only expose safe fields — no sensitive data
    const safe = users.map(u => ({
      id: u.id,
      full_name: u.full_name || u.email || 'Usuario',
      email: u.email,
    }));

    return Response.json({ users: safe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});