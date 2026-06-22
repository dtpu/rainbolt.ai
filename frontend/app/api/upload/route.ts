import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('session_id') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session_id provided' },
        { status: 400 }
      );
    }

    // Create FormData to send to backend (just the file)
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    
    // Send to FastAPI backend with session_id as PATH parameter
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const uploadUrl = `${backendUrl}/upload-image/${encodeURIComponent(sessionId)}`;

    // Server-to-server shared secret so random clients can't hit the backend's
    // upload endpoint directly. Set BACKEND_INTERNAL_KEY (server-only, NOT
    // NEXT_PUBLIC) to the same value here and in the backend's secrets.
    const internalKey = process.env.BACKEND_INTERNAL_KEY;
    const backendResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: backendFormData,
      headers: internalKey ? { 'x-internal-key': internalKey } : {},
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { error: errorData.detail || 'Backend error' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
