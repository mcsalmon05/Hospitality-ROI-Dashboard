from html.parser import HTMLParser

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']: return
        self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']: return
        if not self.stack: return
        expected_tag, pos = self.stack.pop()
        
        while expected_tag != tag and self.stack:
            expected_tag, pos = self.stack.pop()
            
        if self.stack and self.stack[-1][0] == 'main':
             print(f"MAIN BECAME TOP OF STACK AT LINE {self.getpos()[0]} by closing {tag}")

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f: parser.feed(f.read())
