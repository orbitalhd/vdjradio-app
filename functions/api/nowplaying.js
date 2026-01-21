// Cloudflare Pages Function - /functions/api/nowplaying.js
// Scrapes VirtualDJRadio channel pages for current DJ info and schedule

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get('type') || 'dj'; // 'dj' or 'schedule'

  if (type === 'schedule') {
    return getSchedule();
  }

  return getDjInfo();
}

async function getDjInfo() {
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

      // Default values
      let isLive = false;
      let isReplay = false;
      let djName = 'AutoDJ';
      let showName = 'Mixed Hits';
      let djSlug = '';
      let djImage = '';

      // Check status
      isLive = />\s*LIVE\s*</i.test(html) || />\s*Live\s*</i.test(html);
      isReplay = /Replay/i.test(html);

      // Get DJ image - pattern: /image/dj_banner/XXXXX.jpg
      const imageMatch = html.match(/\/image\/dj_banner\/(\d+)\.jpg/);
      if (imageMatch) {
        djImage = `https://virtualdjradio.com/image/dj_banner/${imageMatch[1]}.jpg`;
      }

      // Get DJ slug from profile link - pattern: /djs/djslug/
      const slugMatch = html.match(/\/djs\/([a-z0-9]+)\//i);
      if (slugMatch) {
        djSlug = slugMatch[1];
      }

      // The DJ block in markdown-style looks like:
      // Replay
      // Dj Makoby
      // Club Vibes (2025-08-08)
      
      // Try to match this pattern in the HTML
      const djInfoMatch = html.match(/(?:Replay|Live)\s+(Dj\s+[A-Za-z0-9]+|[A-Z][a-z]+\s*[A-Za-z]*)\s+([A-Za-z0-9\s\-\']+?)\s*\(\d{4}-\d{2}-\d{2}\)/i);
      
      if (djInfoMatch) {
        djName = djInfoMatch[1].trim();
        showName = djInfoMatch[2].trim();
      } else {
        // Alternative pattern - look for text after Replay/Live until the date
        const altMatch = html.match(/(?:Replay|Live)\s*\n?\s*([A-Za-z][A-Za-z0-9\s]+?)\s*\n?\s*([A-Za-z][A-Za-z0-9\s\'\-]+?)\s*\(\d{4}/i);
        if (altMatch) {
          djName = altMatch[1].trim();
          showName = altMatch[2].trim();
        }
      }

      // If we have a slug but no name, try to get name from the page
      if (djSlug && (djName === 'AutoDJ' || !djName)) {
        // Convert slug to name: djmakoby -> Dj Makoby
        djName = djSlug
          .replace(/^dj/i, 'DJ ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .trim();
        // Capitalize first letter of each word
        djName = djName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        djName = djName.replace(/^Dj /, 'DJ ');
      }

      return {
        channel: channel.id,
        channelName: channel.name,
        isLive: isLive && !isReplay,
        isReplay,
        djName: djName || 'AutoDJ',
        showName: showName || 'Mixed Hits',
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
        isReplay: false,
        djName: 'AutoDJ',
        showName: 'Mixed Hits',
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

async function getSchedule() {
  const upcoming = [];
  
  try {
    // Check each channel page for upcoming shows
    const channels = [
      { id: 'clubzone', name: 'ClubZone' },
      { id: 'hypnotica', name: 'Hypnotica' },
      { id: 'powerbase', name: 'PowerBase' },
      { id: 'thegrind', name: 'TheGrind' }
    ];
    
    for (const channel of channels) {
      try {
        const response = await fetch(`https://virtualdjradio.com/${channel.id}/`, {
          headers: { 'User-Agent': 'VDJRadio-App/1.0' }
        });
        const html = await response.text();
        
        // Look for "UPCOMING SHOWS" section content
        const upcomingSection = html.match(/UPCOMING SHOWS([\s\S]*?)(?:POPULAR PAGES|<footer|$)/i);
        
        if (upcomingSection && upcomingSection[1]) {
          // Look for show patterns: time, DJ name, show name
          // Could be in various formats depending on their HTML
          const showMatches = upcomingSection[1].matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–:]?\s*([A-Za-z][A-Za-z\s\-]+?)(?:\s*[-–:]\s*|\s+)([A-Za-z][A-Za-z\s\-\']+?)(?:\s*<|\s*\n|$)/gi);
          
          for (const match of showMatches) {
            upcoming.push({
              time: match[1].trim(),
              djName: match[2].trim(),
              showName: match[3].trim(),
              channel: channel.id,
              channelName: channel.name
            });
          }
        }
      } catch (e) {
        // Continue with other channels
      }
    }

    // Also try the main schedule page
    try {
      const response = await fetch('https://virtualdjradio.com/schedule/', {
        headers: { 'User-Agent': 'VDJRadio-App/1.0' }
      });
      const html = await response.text();
      
      // Look for any scheduled shows on the main page
      const scheduleSection = html.match(/UPCOMING LIVE SETS([\s\S]*?)(?:POPULAR PAGES|<footer|$)/i);
      
      if (scheduleSection && scheduleSection[1]) {
        const showMatches = scheduleSection[1].matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–:]?\s*(?:<[^>]+>)?([A-Za-z][A-Za-z\s\-]+?)(?:<\/[^>]+>)?\s*[-–:]\s*([A-Za-z][A-Za-z\s\-\']+)/gi);
        
        for (const match of showMatches) {
          const exists = upcoming.some(s => 
            s.time === match[1].trim() && s.djName === match[2].trim()
          );
          if (!exists) {
            upcoming.push({
              time: match[1].trim(),
              djName: match[2].trim(),
              showName: match[3].trim()
            });
          }
        }
      }
    } catch (e) {
      // Continue
    }

    return new Response(JSON.stringify({
      upcoming,
      count: upcoming.length,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      upcoming: [],
      count: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}
