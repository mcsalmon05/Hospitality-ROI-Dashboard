from html.parser import HTMLParser

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']:
            attr_dict = dict(attrs)
            name = tag
            if 'id' in attr_dict: name += "#" + attr_dict['id']
            elif 'class' in attr_dict: name += "." + attr_dict['class'].split()[0]
            self.stack.append((tag, name, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'link', 'meta', 'path', 'circle', 'line', 'polyline']:
             return
             
        if not self.stack:
            return
            
        expected_tag, expected_name, pos = self.stack.pop()
        if expected_tag != tag:
            # Mistmatch found, find where we went wrong
            print(f"Mismatch at {self.getpos()}: trying to close <{tag}> but active was <{expected_name}> opened at {pos}")
            while self.stack:
                expected_tag, expected_name, pos = self.stack.pop()
                if expected_tag == tag:
                    break

    def get_stack(self):
        return [name for _, name, _ in self.stack]

parser = StrictHTMLParser()
with open('public/index.html', 'r') as f:
    for i, line in enumerate(f):
        parser.feed(line)
        if 'id="view-settings"' in line:
            print(f"When view-settings is reached (line {i+1}), stack is:")
            print(" -> ".join(parser.get_stack()))
