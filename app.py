import os
import json
import logging
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'notes_cache.json')
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    logger.info("Fetching BigQuery release notes from RSS feed...")
    try:
        # Fetch RSS Feed
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()

        # Parse XML
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            date_str = title.text.strip() if title is not None else "Unknown Date"
            
            entry_id_elem = entry.find('atom:id', ns)
            entry_id = entry_id_elem.text.strip() if entry_id_elem is not None else "no-id"
            
            updated_elem = entry.find('atom:updated', ns)
            updated = updated_elem.text.strip() if updated_elem is not None else ""
            
            # Find alternate link
            link_elem = entry.find("atom:link[@rel='alternate']", ns)
            if link_elem is not None:
                link = link_elem.attrib.get('href', '')
            else:
                first_link = entry.find("atom:link", ns)
                link = first_link.attrib.get('href', '') if first_link is not None else ""

            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text or "" if content_elem is not None else ""
            
            # Use BeautifulSoup to parse headings and split updates
            soup = BeautifulSoup(content_html, 'html.parser')
            h3_tags = soup.find_all('h3')
            
            if not h3_tags:
                # Fallback: single block
                plain_text = soup.get_text(separator=' ').strip()
                # Clean up links to be absolute and open in new tab
                for a in soup.find_all('a'):
                    if a.get('href') and a['href'].startswith('/'):
                        a['href'] = 'https://docs.cloud.google.com' + a['href']
                    a['target'] = '_blank'
                    a['rel'] = 'noopener noreferrer'
                cleaned_html = "".join(str(c) for c in soup.contents).strip()
                
                entries.append({
                    'id': f"{entry_id}_0",
                    'date': date_str,
                    'updated': updated,
                    'link': link,
                    'type': 'General',
                    'content_html': cleaned_html,
                    'content_text': plain_text
                })
            else:
                for idx, h3 in enumerate(h3_tags):
                    note_type = h3.get_text().strip()
                    
                    # Gather elements between this h3 and the next h3
                    sibling_html = []
                    sibling = h3.next_sibling
                    while sibling and sibling.name != 'h3':
                        if sibling.name:
                            sibling_html.append(str(sibling))
                        elif isinstance(sibling, str) and sibling.strip():
                            sibling_html.append(sibling)
                        sibling = sibling.next_sibling
                    
                    item_content_html = "".join(sibling_html).strip()
                    item_soup = BeautifulSoup(item_content_html, 'html.parser')
                    
                    # Clean up links to be absolute and open in new tab
                    for a in item_soup.find_all('a'):
                        if a.get('href') and a['href'].startswith('/'):
                            a['href'] = 'https://docs.cloud.google.com' + a['href']
                        a['target'] = '_blank'
                        a['rel'] = 'noopener noreferrer'
                    
                    cleaned_item_html = "".join(str(c) for c in item_soup.contents).strip()
                    plain_text = item_soup.get_text(separator=' ').strip()
                    
                    entries.append({
                        'id': f"{entry_id}_{idx}",
                        'date': date_str,
                        'updated': updated,
                        'link': link,
                        'type': note_type,
                        'content_html': cleaned_item_html,
                        'content_text': plain_text
                    })
        
        # Save cache
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Successfully fetched and cached {len(entries)} release note items.")
        return entries, False
        
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {str(e)}")
        # Try to load from cache
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    entries = json.load(f)
                logger.info(f"Loaded {len(entries)} items from cache fallback.")
                return entries, True
            except Exception as cache_err:
                logger.error(f"Error reading cache: {str(cache_err)}")
        return [], True

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                entries = json.load(f)
            return jsonify({
                'status': 'success',
                'source': 'cache',
                'data': entries
            })
        except Exception:
            pass
            
    # Fetch fresh or if cache missing/corrupt
    entries, fallback = fetch_and_parse_feed()
    if not entries:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve release notes feed and no cache is available.'
        }), 500
        
    return jsonify({
        'status': 'success',
        'source': 'fallback_cache' if fallback else 'live',
        'data': entries
    })

if __name__ == '__main__':
    # Initialize cache on startup
    if not os.path.exists(CACHE_FILE):
        fetch_and_parse_feed()
    app.run(debug=True, port=5000)
