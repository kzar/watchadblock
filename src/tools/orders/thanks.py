#!/usr/bin/python

# see http://www.doughellmann.com/PyMOTW/imaplib/ for an excellent walkthrough

import csv
import email
import imaplib
import getpass
import os
import re
import smtplib
import tempfile

def order_mailbox(readonly=False):
    m = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    m.login('adblockforchrome@gmail.com', GLOBAL_password)
    m.select('donations', readonly) # if readonly=False, fetching will mark as read
    # http://tools.ietf.org/html/rfc3501.html has all the things you can search with
    return m

def unread_emails(max_count):
    """
    Return Messages list, max max_count entries.  Message.msgid will
    be set to the IMAP msgid.
    """
    m = order_mailbox()
    unseen_ids = m.search(None, '(UNSEEN SINCE "14-May-2011")')[1][0].split()[ :max_count]
    try:
        m.select('donations', readonly=True)
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
            raise # TODO temp
    # Google needs all of its data at once so we can bulk-request info.
    # This also removes order emails whose orders failed to go through.
    GoogleOrder.flesh_out(orders)
    return orders


class Order(object):

    # Abstract methods
    def _build_response(self):
        raise Exception("Override to return a complete thank-you letter body")
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
        self.main_thankyou_note = """\
I wrote AdBlock in the hope that I could make people's lives better.  You just
told me that I managed to do it :) Thank you very, very much!  You are so
great!

It's been a little scary in the few months since I quit my job, hoping that my
users would chip in enough that I could support my family and fund more AdBlock
development.  Not many users are stepping up yet, which makes your contribution
even more appreciated -- as it's way above what most users pay (zero!)

In any case, Katie and I have decided that it's important enough work that I
should keep doing it whether or not we can live off of our users' goodwill,
until we start running out of savings.  You just tipped our scales a little
further away from going broke... did I say thank you yet?  Thank you!  :D

Happy ad blocking,
- Michael"""


    @staticmethod
    def parse(message):
        try:
            body = message.get_payload()[0].get_payload()
        except AttributeError:
            body = message.get_payload()
        if 'AdBlock' not in body:
            import base64
            body = base64.decodestring(body)

        _from = re.search('<(.*?)>', message['from']).group(1)
        if _from == 'noreply@checkout.google.com':
            order = GoogleOrder()
        else:
            order = PayPalOrder()
            order.email = _from
        order.msgid = message.msgid
        order._parse_body(body)
        return order

    def set_response(self, body):
        self._response = body

    def get_response(self):
        if hasattr(self, '_response'):
            return self._response
        return self._build_response()

    def _parse_tracking(self, text):
        tracking_re = 'X([0-9]+)G(.) F(.)O(.)S(.)'
        match = re.search(tracking_re, text)
        (self.experiment, self.group,
         self.flavor, self.os, self.source) = match.groups()

    @staticmethod
    def correct_nicknames(orders):
        """Modify each input order to have a correct nickname."""
        f, fname = tempfile.mkstemp()
        f = os.fdopen(f, 'w')
        writer = csv.writer(f, delimiter='\t')
        for o in orders:
            writer.writerow([o.nickname,o.name,o.email,o.msgid])
        f.close()
        print "Press enter to edit nicknames."
        raw_input()
        os.system('vim -c "set nowrap" -c "set tabstop=20" %s' % fname)
        dmap = dict((o.msgid, o) for o in orders)
        reader = csv.reader(open(fname), delimiter='\t')
        for nickname, name, email, msgid in reader:
            dmap[msgid].nickname = nickname
            dmap[msgid].name = name
            dmap[msgid].email = email
        os.remove(fname)


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

    def _build_response(self):
        original = """

Hello Michael Gundlach,

This email confirms that you have received a payment of $%(amount).2f USD
for AdBlock from %(name)s (%(email)s).

Sincerely,
Google Checkout
""" % self.__dict__
        original = '\n> '.join(original.split('\n'))

        return """\
Hi %(nickname)s!

%(main_thankyou_note)s

PS: Word of mouth is the only marketing AdBlock uses.  If you don't mind, would
you go to http://chromeadblock.com/thanks/ and help me spread the word?  It
would help me IMMENSELY :)


%(original)s
""" % dict(nickname=self.nickname,
           main_thankyou_note = self.main_thankyou_note,
           original=original)


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
        match = re.search('Message: (.*?)=20', body, re.DOTALL)
        if not match:
            match = re.search('payment: Note: (.*?)Contributor:',
                                  body, re.DOTALL)
        if match:
            self.note = self._cleanup(match.group(1))
        self._parse_tracking(body)

    def _build_response(self):
        original = """

Hello Michael Gundlach,

This email confirms that you have received a donation of $%(amount).2f USD
from %(name)s (%(email)s).

Donation details:
  Total amount: $%(amount).2f
  Currency: U.S. Dollars
  Purpose: AdBlock
  Contributor: %(name)s
  Note: %(note)s

Sincerely,
Paypal
""" % self.__dict__
        original = '\n> '.join(original.split('\n'))

        return """\
Hi %(nickname)s!

%(main_thankyou_note)s

PS: If you don't mind, would you go to http://chromeadblock.com/donate/thanks/
and help me spread the word?  I tried setting it up so PayPal would show you
that automatically after you donated, but it doesn't seem to work reliably.
Anyway, it would help me IMMENSELY :)


%(original)s
""" % dict(nickname=self.nickname,
           main_thankyou_note = self.main_thankyou_note,
           original=original)


def send(from_, to, subject, body):
    server = smtplib.SMTP('smtp.gmail.com:587')
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login('adblockforchrome@gmail.com', GLOBAL_password)
    msg = '''\
From: %s
To: %s
Subject: %s

%s''' % (from_, to, subject, body)
    server.sendmail(from_, to, msg)
    server.quit()


def mark_as_read_and_send(orders):
    #TODO temp
    print "Here are the emails I'd have marked read and sent (press Enter to see each):"
    for o in orders:
        print "(%s)\n%s\n\n" % (o.email, o.get_response())
    return
    #TODO end temp


    print "Press enter to mark emails as read and send replies."
    raw_input()
    mailbox = order_mailbox()
    while orders:
        print
        print "%d remaining." % len(orders)
        print
        mark_as_read_and_send_batch(mailbox, orders[:20])
        orders = orders[20:]

def mark_as_read_and_send_batch(m, orders):
    ids = ','.join(o.msgid for o in orders)
    print "Marking these msgids as read:"
    print ids
    # Mark all as read
    m.store(ids, '+FLAGS.SILENT', '\\Seen')
    sending_errors = 0
    for (i,o) in enumerate(orders):
        print "Sending %d of %d to %s ('%s' - %s)" % (i+1, len(orders),
            o.email, o.nickname, o.name)
        try:
            send('adblockforchrome@gmail.com', o.email,
                 'I got your donation :)', o.get_response())
            sending_errors = 0
        except:
            print "  %s Failed to send" % ("*" * 40)
            sending_errors += 1
            if sending_errors == 3:
                print "Aborting!"
                import sys
                sys.exit(1)
            continue

def thank_notes(number_to_thank=200):
    orders = [ o for o in order_messages(number_to_thank) if o.note ]
    Order.correct_nicknames(orders)
    for (i,o) in enumerate(orders):
        print "Press enter to edit message %d of %d." % (i+1, len(orders))
        raw_input()
        open('/tmp/reply.txt', 'w').write(o.get_response())
        os.system('vim -c "normal 1Gw" /tmp/reply.txt')
        o.set_response(open('/tmp/reply.txt').read())
    mark_as_read_and_send(orders)

def thank_no_notes(number_to_thank=200):
    orders = [ o for o in order_messages(number_to_thank) if not o.note ]
    Order.correct_nicknames(orders)
    mark_as_read_and_send(orders)

def usage():
    print "Usage: thanks.py yes - respond to notes"
    print "       thanks.py no  - respond to non-notes"

def main():
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in ['no', 'yes']:
        usage()
        return
    global GLOBAL_password
    GLOBAL_password = getpass.getpass("Password for adblockforchrome@gmail.com: ")
    if sys.argv[1] == 'yes':
        thank_notes()
    else:
        thank_no_notes()

if __name__ == '__main__':
    main()
