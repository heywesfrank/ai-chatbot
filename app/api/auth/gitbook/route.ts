import { NextResponse } from 'next/server';

export async function GET() {
  // These will be securely stored in your Vercel Environment Variables
  const clientId = process.env.GITBOOK_CLIENT_ID;
  const redirectUri = 'https://your-vercel-app.vercel.app/api/auth/callback';
  
  // Send the user to GitBook to authorize your app
  const gitbookAuthUrl = `https://app.gitbook.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  
  return NextResponse.redirect(gitbookAuthUrl);
}
