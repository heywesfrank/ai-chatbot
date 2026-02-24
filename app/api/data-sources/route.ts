// app/api/data-sources/route.ts
export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  
  // Map camelCase to snake_case for Supabase
  const { error } = await supabase.from('data_sources').insert({
    space_id: body.spaceId,
    type: body.type,
    source_uri: body.sourceUri,
    credentials: body.credentials
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
