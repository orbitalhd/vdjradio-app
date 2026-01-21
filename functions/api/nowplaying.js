// Cloudflare Pages Function - /functions/api/nowplaying.js
// Scrapes VirtualDJRadio channel pages for current DJ info

export async function onRequest(context) {
  const channels = [
    { id: 'clubzone', name: 'ClubZone', url: 'https://virtualdjradio.com/clubzone/' },
    { id: 'hypnotica', name: 'Hypnotica', url: 'https://virtualdjradio.com/hypnotica/' },
    { id: 'powerbase', name: 'PowerBase', url: 'https://virtualdjradio.com/powerbase/' },
    { id: 'thegrind', name: 'TheGrind', url: 'https://virtualdjradio.com/thegrind/' }
  ];

  const results = await Promise.all(channels.map(async (channel) => {
    try {
      const response = await fetch(channel.url, {
        headers: { 'User-Agent': 'VDJRadio-App/1.0' }
      });
      const html = await response.text();
      
      // Check if live or replay
      const isLive = html.includes('>LIVE<') || html.includes('>Live<');
      
      // Extract DJ banner image
      let djImage = '';
      const imageMatch = html.match(/\/image\/dj_banner\/(\d+)\.jpg/);
      if (imageMatch) {
        djImage = `https://virtualdjradio.com/image/dj_banner/${imageMatch[1]}.jpg`;
      }
      
      // Extract DJ slug from profile link
      let djSlug = '';
      let djName = 'AutoDJ';
      let showName = 'Mixed Hits';
      
      // Look for the DJ link pattern: href="/djs/djname/"
      const djLinkMatch = html.match(/href="\/djs\/([a-z0-9]+)\/"/i);
      if (djLinkMatch) {
        djSlug = djLinkMatch[1];
      }
      
      // The page has pattern like:
      // LIVE or Replay
      // Dj Name
      // Show Name (2025-08-08)
      
      // Find the section after LIVE/Replay that contains DJ info
      // Looking for text between the banner image and the track history
      const sectionMatch = html.match(/(?:LIVE|Replay)\s*\n*([A-Za-z0-9\s\-\_\.]+)\s*\n*([A-Za-z0-9\s\-\_\.\(\)]+)/i);
      if (sectionMatch) {
        djName = sectionMatch[1].trim().replace(/\s+/g, ' ');
        showName = sectionMatch[2].trim().replace(/\s+/g, ' ');
      }
      
      // Clean up - remove date suffix from show name for display
      const cleanShowName = showName.replace(/\s*\(\d{4}-\d{2}-\d{2}\)/, '');
      
      return {
        channel: channel.id,
        channelName: channel.name,
        isLive,
        djName: djName || 'AutoDJ',
        showName: cleanShowName || 'Live Mix',
        djSlug,
        djImage,
        djProfileUrl: djSlug ? `https://virtualdjradio.com/djs/${djSlug}/` : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        channel: channel.id,
        channelName: channel.name,
        isLive: false,
        djName: 'AutoDJ',
        showName: 'Live Mix',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }));

  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30'
    }
  });
}
