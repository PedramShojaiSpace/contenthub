"""
Convert the full CRO advertorial HTML into a Shopify-safe version.
Shopify's editor strips <style> tags but not <script> tags.
This script embeds all CSS inside a <script> that dynamically injects a <style> tag.
"""
import re

with open('/tmp/orobiome_shopify_cro_v2.html') as f:
    html = f.read()

# Extract the style block
style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
if not style_match:
    raise ValueError("No style block found")

css = style_match.group(1)

# Remove the <style> block from the HTML (Shopify will strip it anyway)
html_no_style = re.sub(r'<style>.*?</style>', '', html, flags=re.DOTALL)

# Also remove the Google Fonts <link> tags (Shopify may strip those too)
# We'll load fonts via JS instead
font_links = re.findall(r'<link[^>]+fonts\.(googleapis|gstatic)[^>]*>', html_no_style)
html_no_style = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)[^>]*>', '', html_no_style)

# Build the JS style injector
# Escape backticks and backslashes in CSS for template literal
css_escaped = css.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

# Build the font loader JS
font_js = """
  // Load Google Fonts
  var fontLink1 = document.createElement('link');
  fontLink1.rel = 'preconnect';
  fontLink1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(fontLink1);
  
  var fontLink2 = document.createElement('link');
  fontLink2.rel = 'preconnect';
  fontLink2.href = 'https://fonts.gstatic.com';
  fontLink2.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink2);
  
  var fontLink3 = document.createElement('link');
  fontLink3.rel = 'stylesheet';
  fontLink3.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Montserrat:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontLink3);
"""

style_injector = f"""<script>
(function() {{
  // Inject advertorial styles (Shopify editor strips <style> tags, so we use JS)
  var style = document.createElement('style');
  style.textContent = `{css_escaped}`;
  document.head.appendChild(style);
  {font_js}
}})();
</script>"""

# Prepend the style injector to the HTML
final_html = style_injector + '\n' + html_no_style.strip()

# Clean up extra blank lines
final_html = re.sub(r'\n{3,}', '\n\n', final_html)

print(f"Final HTML length: {len(final_html)}")
print(f"Has script injector: {'style.textContent' in final_html}")
print(f"Has sticky bar: {'sticky-bar' in final_html}")
print(f"Has testimonials: {'testimonial-card' in final_html}")
print(f"Has FAQ: {'faq-section' in final_html}")
print(f"Has FB pixel: {'fbq(' in final_html}")
print(f"Has cart URL: {'46719608946842' in final_html}")

with open('/tmp/orobiome_shopify_safe.html', 'w') as f:
    f.write(final_html)

print("\nWritten to /tmp/orobiome_shopify_safe.html")
print("\nFirst 500 chars:")
print(final_html[:500])
