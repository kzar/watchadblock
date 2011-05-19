#!/usr/bin/python

"""Parses order objects from emails."""

# see http://www.doughellmann.com/PyMOTW/imaplib/ for an excellent walkthrough

import email
import imaplib
import getpass
import quopri
import re
import smtplib

def init():
    global GLOBAL_password
    GLOBAL_password = getpass.getpass("Password for adblockforchrome@gmail.com: ")

def order_mailbox(readonly=False):
    m = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    m.login('adblockforchrome@gmail.com', GLOBAL_password)
    m.select('orders', readonly) # if readonly=False, fetching marks as read
    # http://tools.ietf.org/html/rfc3501.html has all you can search with
    return m

def unread_emails(max_count):
    """
    Return Messages list, max max_count entries.  Message.msgid will
    be set to the IMAP msgid.
    """
    m = order_mailbox()
    unseen_ids = m.search(None, '(UNSEEN)')[1][0].split()[ :max_count]
    try:
        m.select('orders', readonly=True)
        data = m.fetch(','.join(unseen_ids), '(RFC822)') # not marked as read
        message_data = [ tup[1] for tup in data[1][::2] ]
        messages = [ email.message_from_string(msg) for msg in message_data ]
        for (msgid, message) in zip(unseen_ids, messages):
            message.msgid = msgid
        return messages
    except:
        print
        print "*" * 40
        print "Error reading your mailbox; giving up early."
        raise
    finally:
        m.logout()

def order_messages(max_count):
    """
    Return an iterator containing max_count unread Orders.
    """
    emails = unread_emails(max_count)
    orders = []
    for email in emails:
        try:
            orders.append(Order.parse(email))
        except:
            print ("*" * 70 + '\n') * 3
            print "Ignoring non-order email from %s." % email['from']
            print
    # Google needs all of its data at once so we can bulk-request info.
    # This also removes order emails whose orders failed to go through.
    GoogleOrder.flesh_out(orders)
    return orders


class Order(object):

    # Abstract method
    def _parse_body(self, body):
        raise Exception("Override to fill self with data from email body")

    def __init__(self):
        self.email = None
        self.name = None
        self.nickname = None
        self.experiment = None
        self.flavor = None   # chrome_ext chrome_app safari unknown
        self.os = None       # windows linux mac unknown
        self.source = None   # install chromepopup unknown
        self.amount = None
        self.note = None

    @staticmethod
    def parse(message):
        try:
            body = message.get_payload()[0].get_payload()
        except AttributeError:
            body = message.get_payload()
        if 'AdBlock' not in body:
            import base64
            body = base64.decodestring(body)
        body = quopri.decodestring(body)
        for codec in ['ascii', 'utf-8', 'latin-1']:
            try:
                body = body.decode(codec)
                break
            except:
                pass
        _from = re.search('<(.*?)>', message['from']).group(1)
        if _from == 'noreply@checkout.google.com':
            order = GoogleOrder()
        else:
            order = PayPalOrder()
            order.email = _from
        order.msgid = message.msgid
        order._parse_body(body)
        return order

    def _parse_tracking(self, text):
        tracking_re = 'X([0-9]+)G(.) F(.)O(.)S(.)'
        match = re.search(tracking_re, text)
        (self.experiment, self.group,
         self.flavor, self.os, self.source) = match.groups()


class GoogleOrder(Order):

    @staticmethod
    def flesh_out(orders):
        """
        Fill in details of the GoogleOrders among the given Orders.
        """
        google_order_map = dict( (o.google_order_number, o)
                                 for o in orders
                                 if isinstance(o, GoogleOrder) )
        import orderparsing, math
        orderids = google_order_map.keys()
        numgroups = int(math.ceil(len(orderids) / 16.0))
        # Split into groups of 16
        groups = [orderids[i::numgroups] for i in range(numgroups)]
        for group in groups:
            for datadict in orderparsing.GoogleOrderParser.parse(group):
                google_order_number = datadict['id']
                order = google_order_map[google_order_number]
                order.email = datadict['email']
                order.name = datadict['name']
                order.nickname = order.name.split(' ')[0].title()
                order._parse_tracking(datadict['tracking'])
        # Some Google orders never complete and should be removed
        bad_orders = [ o for o in google_order_map.values() if not o.email ]
        for o in bad_orders:
            orders.remove(o)

    def _parse_body(self, body):
        match = re.search('Total: (=24|\$)(.*)', body)
        self.amount = float(match.group(2).strip())
        match = re.search('Google order number: ([0-9]*)', body)
        self.google_order_number = match.group(1)


class PayPalOrder(Order):
    def _cleanup(self, text):
        """Unescape =XX strings and remove \r lines."""
        def replacer(match):
            return chr(int(match.group(1), 16))
        text = re.sub('=([0-9]{2})', replacer, text)
        text = text.replace('=\r\n', '')
        text = '\n'.join(text.split('\r\n'))
        text = text.strip()
        return text

    def _parse_body(self, body):
        self.name = re.search('Contributor: (.*)', body).group(1).strip()
        self.nickname = self.name.split(' ')[0].title()
        match = re.search('Total amount: *(=24|\$)(.*?) USD', body)
        self.amount = float(match.group(2).strip())
        match = re.search('Message: (.*?)-----------', body, re.DOTALL)
        if not match:
            match = re.search('payment: Note: (.*?)Contributor:',
                                  body, re.DOTALL)
        if match:
            self.note = self._cleanup(match.group(1))
        self._parse_tracking(body)


def send(from_, to, subject, body):
    print "SENDING" # TODO temp
    print to.encode('utf-8')
    print body.encode('utf-8')
    print
    return # TODO temp
    server = smtplib.SMTP('smtp.gmail.com:587')
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login('adblockforchrome@gmail.com', GLOBAL_password)
    msg = '''\
From: %s
To: %s
Subject: %s

%s''' % (from_, to.encode('utf-8'), subject, body.encode('utf-8'))
    server.sendmail(from_, to, msg)
    server.quit()


