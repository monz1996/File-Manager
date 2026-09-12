/** Open a local file via the backend (VLC for video, Photos for images). */
export async function openLocalFile(opts: {
  path: string;
  folder?: string;
  absolute?: boolean;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    return res.ok;
  } catch {
    return false;
  }
}
