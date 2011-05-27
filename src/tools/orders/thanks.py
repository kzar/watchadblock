#!/usr/bin/python

"""Sends thank-you notes in reply to order emails."""

import csv
import os
import tempfile
import traceback
import sys

import emails
import orderparsing
execfile('../../../google_credentials', orderparsing.__dict__)


def correct_nicknames(orders):
    """Modify each input order to have a correct nickname."""
    f, fname = tempfile.mkstemp()
    f = os.fdopen(f, 'w')
    writer = csv.writer(f, delimiter='\t')
    for o in orders:
        writer.writerow([
            o.nickname.encode('utf-8'),
            o.name.encode('utf-8'),
            o.email.encode('utf-8'),
            o.msgid])
    f.close()
    print "Press enter to edit nicknames."
    raw_input()
    os.system('vim -c "set nowrap" -c "set tabstop=20" %s' % fname)
    dmap = dict((o.msgid, o) for o in orders)
    reader = csv.reader(open(fname), delimiter='\t')
    for nickname, name, email, msgid in reader:
        dmap[msgid].nickname = nickname.decode('utf-8')
        dmap[msgid].name = name.decode('utf-8')
        dmap[msgid].email = email.decode('utf-8')
    os.remove(fname)

class EmailResponder(object):
    """Builds response emails."""

    # Abstract method
    def _build_response(self):
        raise Exception("Override to return a complete thank-you letter body")

    def __init__(self, order):
        self.order = order
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
further away from going broke... did I say thank you yet?  Thank you!  :D"""

    def _build_rewards(self):
        if self.order.amount < 30:
            return ""
        if self.order.amount < 50:
            return """

Lastly, here is your haiku, as promised:

   AdBlock salutes you
   for joining in the good fight:
   Open source hero."""
        if self.order.amount < 100:
            return """

Lastly, I owe you a haiku because you are so freaking amazing; what should it
be about?  I apologize in advance that it will be pretty bad poetry."""
        if self.order.amount < 200:
            return """

Lastly, I owe you some tangible goods because you are so freaking amazing!  Let
me know what your haiku should be about, and what you want a drawing of.  The
haiku will be awful.  The drawing will be pretty bad if I draw it, or pretty
great if Katie draws it, so let us know from whom you'd prefer the drawing."""
        if self.order.amount < 300:
            return """

Lastly, I owe you a whole pile of tangible goods because you are so freaking
amazing!  This is basically a form letter, but give me your number and I'll
call you up, and we can figure out the details of the haiku and drawing.  Also,
I sing a lot in addition to coding, so let me know a topic if you'd like a
silly song prepared in advance for you :) Thank you for giving me the
opportunity to do stuff like this!"""
        if self.order.amount < 400:
            return """

Lastly, I owe you a whole pile of tangible goods because you are so freaking
amazing!  This is basically a form letter, but give me your number and I'll
call you up, and we can figure out the details of the haiku/drawing/email
account.  Also, I sing a lot in addition to coding, so let me know a topic if
you'd like a silly song prepared in advance for you :) Thank you for giving me
the opportunity to do stuff like this!"""
        return """

Lastly, I owe you a whole pile of tangible goods because you are so freaking
amazing!  This is basically a form letter, but give me your number and I'll
call you up, and we can figure out the details of the drawing / haiku / wall
art / email account.  Also, I sing a lot in addition to coding, so let me know
a topic if you'd like a silly song prepared in advance for you :) Thank you for
giving me the opportunity to do stuff like this!"""


    def set_response(self, body):
        self._response = body

    def get_response(self):
        if hasattr(self, '_response'):
            return self._response
        return self._build_response()


class GoogleEmailResponder(EmailResponder):

    def _build_response(self):
        original = """

Hello Michael Gundlach,

This email confirms that you have received a payment of $%(amount).2f USD
for AdBlock from %(name)s (%(email)s).

Sincerely,
Google Checkout
""" % self.order.__dict__
        original = '\n> '.join(original.split('\n'))

        return """\
Hi %(nickname)s!

%(main_thankyou_note)s%(rewards)s

Happy ad blocking,
- Michael

PS: Word of mouth is the only marketing AdBlock uses.  If you don't mind, would
you go to http://chromeadblock.com/thanks/ and help me spread the word?  It
would help me IMMENSELY :)
%(original)s
""" % dict(nickname=self.order.nickname,
           main_thankyou_note = self.main_thankyou_note,
           original=original,
           rewards=self._build_rewards())


class PayPalEmailResponder(EmailResponder):

    def _build_response(self):
        original = """

Hello Michael Gundlach,

This email confirms that you have received a payment of $%(amount).2f USD
from %(name)s (%(email)s).

Payment details:
  Total amount: $%(amount).2f
  Currency: U.S. Dollars
  Purpose: AdBlock
  Contributor: %(name)s
  Note: %(note)s

Sincerely,
Paypal
""" % self.order.__dict__
        original = '\n> '.join(original.split('\n'))

        return """\
Hi %(nickname)s!

%(main_thankyou_note)s%(rewards)s

Happy ad blocking,
- Michael

PS: If you didn't get sent to http://chromeadblock.com/pay/thanks/
automatically by PayPal, would you mind going there and helping me spread the
word?  It would help me IMMENSELY :)
%(original)s
""" % dict(nickname=self.order.nickname,
           main_thankyou_note = self.main_thankyou_note,
           original=original,
           rewards=self._build_rewards())


def mark_as_done_and_send(orders):
    mailbox = emails.order_mailbox()
    while orders:
        print
        print "%d remaining." % len(orders)
        print
        mark_as_done_and_send_batch(mailbox, orders[:20])
        orders = orders[20:]

def mark_as_done_and_send_batch(m, orders):
    ids = ','.join(o.msgid for o in orders)
    reward_ids = ','.join(o.msgid for o in orders if o.amount >= 50)
    print "Marking emails from these addresses as read:"
    print ', '.join(o.email for o in orders)
    # Mark all as read
    m.store(ids, '+FLAGS.SILENT', '\\Seen')
    sending_errors = 0
    for (i,o) in enumerate(orders):
        print "Sending %d of %d to %s ('%s' - %s)" % (i+1, len(orders),
            o.email.encode('utf-8'), o.nickname.encode('utf-8'),
            o.name.encode('utf-8'))
        try:
            subj = 'Thank you :)' if o.amount < 50 else 'Thank you so much! :D'
            sender_suffix = '+safari' if o.flavor == 'safari' else ''
            _from = '"Michael Gundlach" <adblockforchrome%s@gmail.com>' % sender_suffix
            to = '"%s" <%s>' % (o.name, o.email)
            emails.send(_from, to, subj, o.email_responder.get_response())
            sending_errors = 0
        except:
            print "  %s Failed to send" % ("*" * 40)
            print traceback.format_tb(sys.exc_info()[2])
            sending_errors += 1
            if sending_errors == 3:
                print "Aborting!"
                sys.exit(1)
            continue

def edit_responses(orders):
    for (i,o) in enumerate(orders):
        print "Press enter to edit message %d of %d." % (i+1, len(orders))
        raw_input()
        resp = o.email_responder.get_response()
        open('/tmp/reply.txt', 'w').write(resp.encode('utf-8'))
        os.system('vim -c "normal 1Gw" /tmp/reply.txt')
        new_resp = open('/tmp/reply.txt').read().decode('utf-8')
        o.email_responder.set_response(new_resp)

def thank(orders, edit_every_response):
    for o in orders:
        if isinstance(o, emails.GoogleOrder):
            o.email_responder = GoogleEmailResponder(o)
        else:
            o.email_responder = PayPalEmailResponder(o)
    correct_nicknames(orders)
    manual = [ o for o in orders if o.amount >= 50 ]
    auto =   [ o for o in orders if o.amount < 50 ]
    if manual:
        print "Editing %d of %d emails that need followup." % (
                len(manual), len(orders))
        edit_responses(manual)
    if edit_every_response and auto:
        print "Editing %d of %d regular emails." % (len(auto), len(orders))
        edit_responses(auto)
    print "Press enter to mark emails as read and send replies."
    raw_input()
    print "Sending %d to be followed up." % len(manual)
    if manual:
        mark_as_done_and_send(manual)
    print "Sending %d needing no followup." % len(auto)
    if auto:
        mark_as_done_and_send(auto)

def thank_notes(number_to_thank=200):
    orders = [ o for o in emails.order_messages(number_to_thank) if o.note ]
    thank(orders, edit_every_response=True)

def thank_no_notes(number_to_thank=200):
    orders = [ o for o in emails.order_messages(number_to_thank) if not o.note ]
    thank(orders, edit_every_response=False)

def usage():
    print "Usage: thanks.py yes - respond to notes"
    print "       thanks.py no  - respond to non-notes"

def main():
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in ['no', 'yes']:
        usage()
        return
    if sys.argv[1] == 'yes':
        thank_notes()
    else:
        thank_no_notes()

if __name__ == '__main__':
    main()
