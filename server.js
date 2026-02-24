const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable for cloud hosting

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Route to fetch Strava route data
app.get('/api/fetch-strava-route', async (req, res) => {
    try {
        const routeUrl = req.query.url || req.query.routeUrl;
        
        if (!routeUrl) {
            return res.status(400).json({ error: 'Route URL is required' });
        }

        // Ensure URL is a valid Strava route URL
        if (!routeUrl.includes('strava.com')) {
            return res.status(400).json({ error: 'Invalid Strava URL' });
        }

        // Fetch the route page
        const response = await fetch(routeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: `Failed to fetch route: ${response.statusText}` 
            });
        }

        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Patterns for matching distance and elevation
        const distancePattern = /(\d+\.?\d*)\s*(mi|km|miles|kilometers|m|meters)/i;
        const elevationPattern = /(\d{1,3}(?:,\d{3})*|\d+)\s*(ft|feet|m|meters|m\b)/i;

        // Helper function to find the most reasonable value (filter out unrealistic values)
        // Bike routes are typically 0.1-200 miles and 0-20,000 feet elevation
        function findReasonableDistance(matches) {
            if (!matches || matches.length === 0) return null;
            const reasonableValues = [];
            for (const match of matches) {
                const parsed = match.match(distancePattern);
                if (parsed) {
                    let value = parseFloat(parsed[1]);
                    const unit = parsed[2].toLowerCase();
                    // Convert to miles for comparison
                    if (unit === 'km' || unit === 'kilometers') value = value * 0.621371;
                    else if (unit === 'm' || unit === 'meters') value = value * 0.000621371;
                    
                    // Filter: bike routes are typically 0.1-200 miles
                    if (value >= 0.1 && value <= 200) {
                        reasonableValues.push({ value: value, match: parsed, originalValue: parseFloat(parsed[1]), originalUnit: unit });
                    }
                }
            }
            
            if (reasonableValues.length === 0) return null;
            
            // Return the median or most common value (often more reliable than largest)
            // For now, return the one closest to the middle of reasonable range
            reasonableValues.sort((a, b) => a.value - b.value);
            const medianIndex = Math.floor(reasonableValues.length / 2);
            return reasonableValues[medianIndex].match;
        }

        function findReasonableElevation(matches) {
            if (!matches || matches.length === 0) return null;
            const reasonableValues = [];
            for (const match of matches) {
                const parsed = match.match(elevationPattern);
                if (parsed) {
                    let value = parseInt(parsed[1].replace(/,/g, ''));
                    const unit = parsed[2].toLowerCase();
                    // Convert to feet for comparison
                    if (unit === 'm' || unit === 'meters') value = value * 3.28084;
                    
                    // Filter: bike routes are typically 0-20,000 feet elevation
                    if (value >= 0 && value <= 20000) {
                        reasonableValues.push({ value: value, match: parsed, originalValue: parseInt(parsed[1].replace(/,/g, '')), originalUnit: unit });
                    }
                }
            }
            
            if (reasonableValues.length === 0) return null;
            
            // Return the median value (often more reliable than largest)
            reasonableValues.sort((a, b) => a.value - b.value);
            const medianIndex = Math.floor(reasonableValues.length / 2);
            return reasonableValues[medianIndex].match;
        }

        // Extract route name (usually in h1 or title)
        let routeName = '';
        const h1 = document.querySelector('h1');
        if (h1) {
            routeName = h1.textContent.trim();
        } else {
            const title = document.querySelector('title');
            if (title) {
                routeName = title.textContent.replace(' | Strava', '').replace('Strava Route | ', '').trim();
            }
        }

        // Try to find route name in meta tags
        if (!routeName) {
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                routeName = ogTitle.getAttribute('content').replace(' | Strava', '').trim();
            }
        }

        // Extract distance, elevation, and estimated time from the page
        let distance = null;
        let elevation = null;
        let estimatedTime = null;

        // Check the parent container of h1 for route stats (Strava often puts stats near the title)
        if (h1) {
            const h1Parent = h1.parentElement;
            if (h1Parent) {
                const parentText = h1Parent.textContent || '';
                if (!distance) {
                    const distMatches = parentText.match(/(\d+\.?\d*)\s*(mi|km|miles|kilometers)\b/gi);
                    if (distMatches && distMatches.length > 0) {
                        const match = findReasonableDistance(distMatches);
                        if (match) {
                            const value = match[1];
                            const unit = match[2].toLowerCase();
                            distance = unit === 'km' || unit === 'kilometers' 
                                ? `${parseFloat(value).toFixed(2)} km`
                                : `${parseFloat(value).toFixed(2)} mi`;
                        }
                    }
                }
                if (!elevation) {
                    const elevMatches = parentText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(ft|feet|m\b|meters)\b/gi);
                    if (elevMatches && elevMatches.length > 0) {
                        const match = findReasonableElevation(elevMatches);
                        if (match) {
                            const value = match[1].replace(/,/g, '');
                            const unit = match[2].toLowerCase();
                            elevation = unit === 'm' || unit === 'meters'
                                ? `${parseInt(value).toLocaleString()} m`
                                : `${parseInt(value).toLocaleString()} ft`;
                        }
                    }
                }
                // Skip time extraction from h1Parent - it often picks up incorrect MM:SS values
                // Time extraction will be done from routeStat divs which are more reliable
            }
        }

        // Method 1: Look for structured data or JSON-LD
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.textContent);
                if (data.name && !routeName) routeName = data.name;
                if (data.distance && !distance) {
                    const dist = parseFloat(data.distance);
                    distance = dist > 1 ? `${dist.toFixed(1)} km` : `${(dist * 1000).toFixed(0)} m`;
                }
                if (data.elevation && !elevation) {
                    elevation = `${parseInt(data.elevation).toLocaleString()} m`;
                }
            } catch (e) {
                // Not valid JSON, continue
            }
        }

        // Method 2: Look for span elements within routeStat divs (exact structure from Strava)
        // Strava structure: <div class="Detail_routeStat_..."><svg>...</svg><span>18.64 mi</span></div>
        const routeStatDivs = document.querySelectorAll('[class*="routeStat"]');
        
        if (routeStatDivs && routeStatDivs.length > 0) {
            const routeStatValues = Array.from(routeStatDivs).map(div => {
                // Get the span inside this div (Strava puts the value in a span)
                const span = div.querySelector('span');
                return span ? span.textContent.trim() : div.textContent.trim();
            }).filter(text => text);
            
            // Extract distance values
            if (!distance && routeStatValues.length > 0) {
                const distanceValues = routeStatValues.filter(text => 
                    /^\d+\.?\d*\s*(mi|km|miles|kilometers)$/i.test(text)
                );
                
                if (distanceValues.length > 0) {
                    const match = findReasonableDistance(distanceValues);
                    if (match) {
                        const value = match[1];
                        const unit = match[2].toLowerCase();
                        distance = unit === 'km' || unit === 'kilometers'
                            ? `${parseFloat(value).toFixed(2)} km`
                            : `${parseFloat(value).toFixed(2)} mi`;
                    }
                }
            }
            
            // Extract elevation values
            if (!elevation && routeStatValues.length > 0) {
                const elevationValues = routeStatValues.filter(text => 
                    /^[\d,]+\.?\d*\s*(ft|feet|m\b|meters)$/i.test(text)
                );
                
                if (elevationValues.length > 0) {
                    const match = findReasonableElevation(elevationValues);
                    if (match) {
                        const value = match[1].replace(/,/g, '');
                        const unit = match[2].toLowerCase();
                        elevation = unit === 'm' || unit === 'meters'
                            ? `${parseInt(value).toLocaleString()} m`
                            : `${parseInt(value).toLocaleString()} ft`;
                    }
                }
            }
            
            // Extract estimated time values (format: HH:MM:SS or H:MM:SS)
            // Strava displays time in routeStat divs as HH:MM:SS format (e.g., "1:32:49")
            if (!estimatedTime && routeStatValues.length > 0) {
                // First, try to find HH:MM:SS format times (3 parts: hours:minutes:seconds)
                const hmsTimes = routeStatValues.filter(text => {
                    const trimmed = text.trim();
                    // Match HH:MM:SS format (1-2 digits:2 digits:2 digits)
                    const hmsMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
                    if (hmsMatch) {
                        const hours = parseInt(hmsMatch[1]);
                        const minutes = parseInt(hmsMatch[2]);
                        const seconds = parseInt(hmsMatch[3]);
                        // Validate: hours 0-24, minutes 0-59, seconds 0-59
                        return hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60;
                    }
                    return false;
                });
                
                if (hmsTimes.length > 0) {
                    // Use the first HH:MM:SS time found (should be the route estimated time)
                    estimatedTime = hmsTimes[0].trim();
                } else {
                    // Fallback: look for any time pattern, but prioritize HH:MM:SS
                    const allTimeValues = routeStatValues.filter(text => {
                        const trimmed = text.trim();
                        return /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed);
                    });
                    
                    if (allTimeValues.length > 0) {
                        // Extract and prioritize HH:MM:SS format
                        const timeMatches = allTimeValues.map(text => {
                            const match = text.trim().match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
                            return match ? match[1] : text.trim();
                        });
                        
                        // Sort: prefer HH:MM:SS (3 parts) over MM:SS (2 parts)
                        timeMatches.sort((a, b) => {
                            const aParts = a.split(':');
                            const bParts = b.split(':');
                            
                            // Prefer HH:MM:SS format over MM:SS
                            if (aParts.length !== bParts.length) {
                                return bParts.length - aParts.length;
                            }
                            
                            // If both are HH:MM:SS, prefer times in the 1-3 hour range (typical route times)
                            if (aParts.length === 3 && bParts.length === 3) {
                                const aHours = parseInt(aParts[0]);
                                const bHours = parseInt(bParts[0]);
                                const aInRange = aHours >= 1 && aHours <= 3;
                                const bInRange = bHours >= 1 && bHours <= 3;
                                if (aInRange !== bInRange) {
                                    return bInRange ? 1 : -1;
                                }
                            }
                            
                            return 0;
                        });
                        
                        estimatedTime = timeMatches[0];
                    }
                }
            }
        }
        
        // Fallback: Look for any span elements containing distance/elevation
        if (!distance) {
            const allSpans = document.querySelectorAll('span');
            const distanceSpans = Array.from(allSpans).filter(span => {
                const text = span.textContent.trim();
                return /^\d+\.?\d*\s*(mi|km|miles|kilometers)$/i.test(text);
            });
            
            if (distanceSpans.length > 0) {
                const distanceValues = distanceSpans.map(span => span.textContent.trim());
                const match = findReasonableDistance(distanceValues);
                if (match) {
                    const value = match[1];
                    const unit = match[2].toLowerCase();
                    distance = unit === 'km' || unit === 'kilometers'
                        ? `${parseFloat(value).toFixed(2)} km`
                        : `${parseFloat(value).toFixed(2)} mi`;
                }
            }
        }
        
        if (!elevation) {
            const allSpans = document.querySelectorAll('span');
            const elevationSpans = Array.from(allSpans).filter(span => {
                const text = span.textContent.trim();
                return /^[\d,]+\.?\d*\s*(ft|feet|m\b|meters)$/i.test(text);
            });
            
            if (elevationSpans.length > 0) {
                const elevationValues = elevationSpans.map(span => span.textContent.trim());
                const match = findReasonableElevation(elevationValues);
                if (match) {
                    const value = match[1].replace(/,/g, '');
                    const unit = match[2].toLowerCase();
                    elevation = unit === 'm' || unit === 'meters'
                        ? `${parseInt(value).toLocaleString()} m`
                        : `${parseInt(value).toLocaleString()} ft`;
                }
            }
        }
        
        // Method 2b: Look for specific Strava route stats elements
        // Strava uses classes like "Detail_routeStat_aR_oX" (the suffix changes, but "routeStat" is consistent)
        // These contain the actual route statistics in span elements
        const routeStatElements = document.querySelectorAll('[class*="routeStat"], [class*="RouteStat"], [class*="route-stat"]');
        
        if (routeStatElements && routeStatElements.length > 0 && (!distance || !elevation)) {
            // Extract text from all route stat elements
            const routeStatTexts = Array.from(routeStatElements).map(el => el.textContent.trim()).filter(text => text);
            
            // Look for distance in route stat elements
            if (!distance && routeStatTexts.length > 0) {
                const allDistanceMatches = [];
                routeStatTexts.forEach(text => {
                    const matches = text.match(/(\d+\.?\d*)\s*(mi|km|miles|kilometers)\b/gi);
                    if (matches) {
                        allDistanceMatches.push(...matches);
                    }
                });
                
                if (allDistanceMatches.length > 0) {
                    const match = findReasonableDistance(allDistanceMatches);
                    if (match) {
                        const value = match[1];
                        const unit = match[2].toLowerCase();
                        if (unit === 'km' || unit === 'kilometers') {
                            distance = `${parseFloat(value).toFixed(2)} km`;
                        } else {
                            distance = `${parseFloat(value).toFixed(2)} mi`;
                        }
                    }
                }
            }
            
            // Look for elevation in route stat elements
            if (!elevation && routeStatTexts.length > 0) {
                const allElevationMatches = [];
                routeStatTexts.forEach(text => {
                    const matches = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(ft|feet|m\b|meters)\b/gi);
                    if (matches) {
                        allElevationMatches.push(...matches);
                    }
                });
                
                if (allElevationMatches.length > 0) {
                    const match = findReasonableElevation(allElevationMatches);
                    if (match) {
                        const value = match[1].replace(/,/g, '');
                        const unit = match[2].toLowerCase();
                        if (unit === 'm' || unit === 'meters') {
                            elevation = `${parseInt(value).toLocaleString()} m`;
                        } else {
                            elevation = `${parseInt(value).toLocaleString()} ft`;
                        }
                    }
                }
            }
            
            // Look for estimated time in route stat elements
            if (!estimatedTime && routeStatTexts.length > 0) {
                const timeValues = routeStatTexts.filter(text => {
                    // Match time patterns like 2:04:20, 1:30:00, 45:30, etc.
                    const trimmed = text.trim();
                    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed) || 
                           /\d{1,2}:\d{2}(:\d{2})?/.test(trimmed);
                });
                
                if (timeValues.length > 0) {
                    // Extract time patterns and prioritize longer formats
                    const timeMatches = timeValues.map(text => {
                        const match = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
                        return match ? match[1] : text.trim();
                    });
                    
                    // Sort by: 1) length (longer = HH:MM:SS format), 2) hours value (prefer 1-3 hours)
                    timeMatches.sort((a, b) => {
                        const aParts = a.split(':');
                        const bParts = b.split(':');
                        const aHours = aParts.length === 3 ? parseInt(aParts[0]) : 0;
                        const bHours = bParts.length === 3 ? parseInt(bParts[0]) : 0;
                        
                        // Prefer HH:MM:SS format over MM:SS
                        if (aParts.length !== bParts.length) {
                            return bParts.length - aParts.length;
                        }
                        
                        // If both are HH:MM:SS, prefer times in the 1-3 hour range (typical route times)
                        if (aParts.length === 3 && bParts.length === 3) {
                            const aInRange = aHours >= 1 && aHours <= 3;
                            const bInRange = bHours >= 1 && bHours <= 3;
                            if (aInRange !== bInRange) {
                                return bInRange ? 1 : -1;
                            }
                        }
                        
                        return 0;
                    });
                    
                    estimatedTime = timeMatches[0];
                }
            }
        }
        
        // Fallback: Look for route stats sections with broader selectors
        const routeStatsSection = document.querySelector('[class*="route-stats"], [class*="route-header"], [class*="route-info"], [data-testid*="route"]');
        
        if (routeStatsSection && (!distance || !elevation)) {
            const statsText = routeStatsSection.textContent || '';
            
            if (!distance) {
                const distMatches = statsText.match(/(\d+\.?\d*)\s*(mi|km|miles|kilometers)\b/gi);
                if (distMatches && distMatches.length > 0) {
                    const match = findReasonableDistance(distMatches);
                    if (match) {
                        const value = match[1];
                        const unit = match[2].toLowerCase();
                        if (unit === 'km' || unit === 'kilometers') {
                            distance = `${parseFloat(value).toFixed(2)} km`;
                        } else {
                            distance = `${parseFloat(value).toFixed(2)} mi`;
                        }
                    }
                }
            }
            
            if (!elevation) {
                const elevMatches = statsText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(ft|feet|m\b|meters)\b/gi);
                if (elevMatches && elevMatches.length > 0) {
                    const match = findReasonableElevation(elevMatches);
                    if (match) {
                        const value = match[1].replace(/,/g, '');
                        const unit = match[2].toLowerCase();
                        if (unit === 'm' || unit === 'meters') {
                            elevation = `${parseInt(value).toLocaleString()} m`;
                        } else {
                            elevation = `${parseInt(value).toLocaleString()} ft`;
                        }
                    }
                }
            }
        }
        
        // Fallback: Look for specific Strava data attributes
        const distanceEl = document.querySelector('[data-testid*="distance"], [class*="distance"], [id*="distance"]');
        const elevationEl = document.querySelector('[data-testid*="elevation"], [class*="elevation"], [id*="elevation"]');
        
        if (distanceEl && !distance) {
            const distText = distanceEl.textContent || distanceEl.getAttribute('content') || '';
            const match = distText.match(distancePattern);
            if (match) {
                const value = match[1];
                const unit = match[2].toLowerCase();
                if (unit === 'km' || unit === 'kilometers') {
                    distance = `${parseFloat(value).toFixed(2)} km`;
                } else if (unit === 'm' || unit === 'meters') {
                    const km = parseFloat(value) / 1000;
                    distance = km > 1 ? `${km.toFixed(2)} km` : `${value} m`;
                } else {
                    distance = `${parseFloat(value).toFixed(2)} mi`;
                }
            }
        }

        if (elevationEl && !elevation) {
            const elevText = elevationEl.textContent || elevationEl.getAttribute('content') || '';
            const match = elevText.match(elevationPattern);
            if (match) {
                const value = match[1].replace(/,/g, '');
                const unit = match[2].toLowerCase();
                if (unit === 'm' || unit === 'meters') {
                    elevation = `${parseInt(value).toLocaleString()} m`;
                } else {
                    elevation = `${parseInt(value).toLocaleString()} ft`;
                }
            }
        }

        // Method 3: Search through page text content - look for reasonable values (filter unrealistic ones)
        if (!distance || !elevation || !estimatedTime) {
            const bodyText = document.body.textContent || '';
            
            // Look for distance patterns - find reasonable values (filter out unrealistic ones)
            if (!distance) {
                const distanceMatches = bodyText.match(/(\d+\.?\d*)\s*(mi|km|miles|kilometers)\b/gi);
                if (distanceMatches && distanceMatches.length > 0) {
                    const match = findReasonableDistance(distanceMatches);
                    if (match) {
                        const value = match[1];
                        const unit = match[2].toLowerCase();
                        if (unit === 'km' || unit === 'kilometers') {
                            distance = `${parseFloat(value).toFixed(2)} km`;
                        } else {
                            distance = `${parseFloat(value).toFixed(2)} mi`;
                        }
                    }
                }
            }

            // Look for elevation patterns - find reasonable values (filter out unrealistic ones)
            if (!elevation) {
                const elevationMatches = bodyText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(ft|feet|m\b|meters)\b/gi);
                if (elevationMatches && elevationMatches.length > 0) {
                    const match = findReasonableElevation(elevationMatches);
                    if (match) {
                        const value = match[1].replace(/,/g, '');
                        const unit = match[2].toLowerCase();
                        if (unit === 'm' || unit === 'meters') {
                            elevation = `${parseInt(value).toLocaleString()} m`;
                        } else {
                            elevation = `${parseInt(value).toLocaleString()} ft`;
                        }
                    }
                }
            }
            
            // Look for estimated time patterns in body text
            if (!estimatedTime) {
                // Try to find time patterns in the page text
                // Look for patterns like "2:04:20" or "1:30:00" or "45:30"
                const timeMatches = bodyText.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g);
                if (timeMatches && timeMatches.length > 0) {
                    // Filter to only reasonable time values (not dates, not too long)
                    const reasonableTimes = timeMatches.filter(time => {
                        const parts = time.split(':');
                        if (parts.length === 2) {
                            // MM:SS format - minutes should be 0-59, seconds 0-59
                            const mins = parseInt(parts[0]);
                            const secs = parseInt(parts[1]);
                            return mins >= 0 && mins < 60 && secs >= 0 && secs < 60;
                        } else if (parts.length === 3) {
                            // HH:MM:SS format - hours should be reasonable (0-24), minutes/seconds 0-59
                            const hours = parseInt(parts[0]);
                            const mins = parseInt(parts[1]);
                            const secs = parseInt(parts[2]);
                            return hours >= 0 && hours <= 24 && mins >= 0 && mins < 60 && secs >= 0 && secs < 60;
                        }
                        return false;
                    });
                    
                    if (reasonableTimes.length > 0) {
                        // Use the first reasonable time found
                        estimatedTime = reasonableTimes[0];
                    }
                }
            }
        }

        // Method 4: Check meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            const desc = metaDescription.getAttribute('content');
            
            if (!distance) {
                const descDistanceMatch = desc.match(distancePattern);
                if (descDistanceMatch) {
                    const value = descDistanceMatch[1];
                    const unit = descDistanceMatch[2].toLowerCase();
                    distance = unit === 'km' || unit === 'kilometers' 
                        ? `${parseFloat(value).toFixed(1)} km`
                        : `${parseFloat(value).toFixed(1)} mi`;
                }
            }
            
            if (!elevation) {
                const descElevationMatch = desc.match(elevationPattern);
                if (descElevationMatch) {
                    const value = descElevationMatch[1].replace(/,/g, '');
                    const unit = descElevationMatch[2].toLowerCase();
                    elevation = unit === 'm' || unit === 'meters'
                        ? `${parseInt(value).toLocaleString()} m`
                        : `${parseInt(value).toLocaleString()} ft`;
                }
            }
        }

        res.json({
            success: true,
            name: routeName || null,
            distance: distance || null,
            elevation: elevation || null,
            estimatedTime: estimatedTime || null,
            url: routeUrl
        });

    } catch (error) {
        console.error('Error fetching Strava route:', error);
        res.status(500).json({ 
            error: 'Failed to fetch route data',
            message: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Strava route proxy server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/fetch-strava-route?url=<strava-route-url>`);
});

