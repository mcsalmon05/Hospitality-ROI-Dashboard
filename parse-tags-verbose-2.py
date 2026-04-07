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
        if 'id' in attr_dict and attr_dict['id'].startswith('view-'):
            print(f"When {attr_dict['id']} is reached (line {self.getpos()[0]}), stack is:")
            print(" -> ".join(self.get_stack()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']: return
        if not self.stack: return
        expected_tag, expected_name, pos = self.stack.pop()
        while expected_tag != tag and self.stack:
            expected_tag, expected_name, pos = self.stack.pop()

    def get_stack(self): return [name for _, name, _ in self.stack]

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f: parser.feed(f.read())
