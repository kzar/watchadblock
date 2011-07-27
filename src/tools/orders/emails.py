#!/usr/bin/python

"""Parses order objects from emails."""

# see http://www.doughellmann.com/PyMOTW/imaplib/ for an excellent walkthrough

import datetime
import email.utils
import imaplib
import getpass
import quopri
import re
import smtplib

import orderparsing

def _get_password():
    if 'GLOBAL_password' in globals():
        return
    global GLOBAL_password
    GLOBAL_password = getpass.getpass("Password for adblockforchrome@gmail.com: ")

def order_mailbox(readonly=False):
    _get_password()
    m = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    m.login('adblockforchrome@gmail.com', GLOBAL_password)
    m.select('orders', readonly) # if readonly=False, fetching marks as read
    # http://tools.ietf.org/html/rfc3501.html has all you can search with
    return m

def unread_emails(max_count, query):
    """
    Return Messages list, max max_count entries.  Message.msgid will
    be set to the IMAP msgid.
    """
    m = order_mailbox()
    unseen_ids = m.search(None, query)[1][0].split()[ :max_count]
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

def order_messages(max_count, query='(UNSEEN)'):
    """
    Return an iterator containing max_count unread Orders.
    """
    emails = unread_emails(max_count, query)
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
    # For those who sent a userid rather than explicit tracking info
    orderparsing.Tracking.load_from_database(o for o in orders if o.userid)
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
        self.group = None
        self.flavor = "U"    # EASU chrome_ext chrome_app safari unknown
        self.os = "U"        # WLMCU windows linux mac cros unknown
        self.source = "U"    # IPOU install chromepopup options unknown
        self.amount = None
        self.note = None
        self.userid = None

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
        date_tuple = email.utils.parsedate(message['date'])[:6]
        order.date = datetime.datetime(*date_tuple)
        order._parse_body(body)
        order.body = body
        return order

    def _parse_tracking(self, text):
        """
        Fill in as much tracking info as is available from the text.
        We may have to go to the database later to get the details.
        """
        tracking_re = 'X([0-9]+)G(.) (?:F(.))?(?:O(.))?(?:S(.))?(?: ([a-z0-9]{16}))?'
        match = re.search(tracking_re, text)
        groups = match.groups()
        self.experiment = int(groups[0])
        self.group = int(groups[1])
        # Fill in those that are supplied to us.
        self.flavor = groups[2] or self.flavor
        self.os = groups[3] or self.os
        self.source = groups[4] or self.source
        self.userid = groups[5] or self.userid


class GoogleOrder(Order):

    @staticmethod
    def flesh_out(orders):
        """
        Fill in details of the GoogleOrders among the given Orders.
        """
        google_order_map = dict( (o.google_order_number, o)
                                 for o in orders
                                 if isinstance(o, GoogleOrder) )
        import math
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
        """Remove \r lines from a note."""
        text = text.replace('=\r\n', '')
        text = '\n'.join(text.split('\r\n'))
        text = text.strip()
        return text

    def _parse_body(self, body):
        if 'You received a payment' in body:
            self._parse_body_new(body)
        else:
            self._parse_body_old(body)
        self.nickname = self.name.split(' ')[0].title()
        self._parse_tracking(body)

    def _parse_body_old(self, body):
        """Parse pre-(xclick/PPDG) emails."""
        match = re.search('(?:Buyer|Contributor): (.*)', body)
        self.name = match.group(1).strip()
        match = re.search('Total Amount: *(=24|\$)(.*?) USD', body)
        self.amount = float(match.group(2))
        match = re.search('Message: (.*?)-----------', body, re.DOTALL)
        if not match:
            match = re.search('payment: Note: (.*?)Contributor:',
                                  body, re.DOTALL)
        if match:
            self.note = self._cleanup(match.group(1))

    def _parse_body_new(self, body):
        """Parse xclick/PPDG emails."""
        regex = 'Buyer(?: information)?:\r?\n(.*)'
        self.name = re.search(regex, body, re.MULTILINE).group(1).strip()
        match = re.search('Total: \$(.*?) USD', body)
        self.amount = float(match.group(1))
        # If a note existed, it would be 'Instructions to merchant' or
        # 'Instructions from buyer'


class Mailer(object):

    """Sends multiple emails via a persistent connection."""

    def __init__(self):
        self.server = None # if not None, we think we're logged in

    def _login(self, force=False):
        """
        Log into the mail server.
        force: if True, re-login even if we think we're logged in.
        """
        if self.server and not force:
            return
        if self.server:
            try:
                self.server.quit()
            except:
                pass
            self.server = None
        _get_password()
        print "Logging in...",
        self.server = smtplib.SMTP('smtp.gmail.com:587')
        self.server.ehlo()
        self.server.starttls()
        self.server.ehlo()
        self.server.login('adblockforchrome@gmail.com', GLOBAL_password)
        print " success."

    def send(self, from_, to, subject, body, _is_second_attempt=False):
        """
        Send an email.  Log in if we're not logged in.  If logging in fails,
        raise.  If sending fails, re-login and reattempt.  If the reattempt
        fails, raise.
        """
        msg = '''\
From: %s
To: %s
Subject: %s

%s''' % (from_, to.encode('utf-8'), subject, body.encode('utf-8'))
        _get_password()
        self._login(force=False) # no-op if already logged in
        try:
            self.server.sendmail(from_, to, msg)
        except Exception, e:
            if _is_second_attempt:
                raise
            else:
                self._login(force=True)
                self.send(from_, to, subject, body, _is_second_attempt=True)
