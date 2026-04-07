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
        
        if self.getpos()[0] == 631:
            print(f"AT LINE 631 closing {tag}, stack top was {expected_tag} opened at {pos[0]}")
            
        while expected_tag != tag and self.stack:
            expected_tag, pos = self.stack.pop()

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f: parser.feed(f.read())
