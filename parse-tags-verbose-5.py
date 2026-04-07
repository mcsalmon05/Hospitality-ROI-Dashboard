from html.parser import HTMLParser

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']: return
        attr_dict = dict(attrs)
        name = tag
        if 'id' in attr_dict: name += "#" + attr_dict['id']
        elif 'class' in attr_dict: name += "." + attr_dict['class'].split()[0]
        self.stack.append((tag, name, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']: return
        if not self.stack: return
        expected_tag, expected_name, pos = self.stack.pop()
        
        if 556 <= self.getpos()[0] <= 629:
            print(f"L{self.getpos()[0]}: closed <{expected_name}> (opened at L{pos[0]})")
            if expected_name == "div#view-settings":
                print(">>> view-settings was PREMATURELY closed!")
            
        while expected_tag != tag and self.stack:
            expected_tag, expected_name, pos = self.stack.pop()

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f: parser.feed(f.read())
