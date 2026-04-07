from html.parser import HTMLParser
import sys

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']:
             return
             
        if not self.stack:
            print(f"Extra closing tag </{tag}> at line {self.getpos()[0]}")
            return
            
        expected_tag, pos = self.stack.pop()
        if expected_tag != tag:
            print(f"Mismatch: Expected </{expected_tag}> (opened line {pos[0]}), got </{tag}> at line {self.getpos()[0]}")
            # Try to recover by unwinding stack until we find the matching tag
            while self.stack:
                expected_tag, pos = self.stack.pop()
                if expected_tag == tag:
                    break

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f:
    parser.feed(f.read())

for tag, pos in parser.stack:
    print(f"Unclosed tag <{tag}> at line {pos[0]}")
