from html.parser import HTMLParser

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_p = False

    def handle_starttag(self, tag, attrs):
        if tag == 'p': self.in_p = True
        elif tag == 'div' and self.in_p:
            print(f"ERROR: div inside p at line {self.getpos()[0]}")

    def handle_endtag(self, tag):
        if tag == 'p': self.in_p = False

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f: parser.feed(f.read())
