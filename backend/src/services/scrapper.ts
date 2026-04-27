export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Fakescope-Bot/1.0 (Educational Fact-Checking)',
      },
    });

    if (!response.ok) return '';

    const html = await response.text();

    // Basic cleaning: Remove scripts, styles, and tags to save LLM tokens
    const cleanText = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Collapse multiple spaces
      .trim();

    return cleanText;
  } catch (error) {
    console.error(`Failed to fetch content for ${url}:`, error);
    return '';
  }
}