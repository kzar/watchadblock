#!/usr/bin/python

#TODO: check for people who donate multiple times.

import email
import imaplib
import getpass
import os
import re
import smtplib

# see http://www.doughellmann.com/PyMOTW/imaplib/ for an excellent walkthrough
GLOBAL_password = getpass.getpass("Password for gundlach@gmail.com: ")

def send(from_, to, subject, body):
    server = smtplib.SMTP('smtp.gmail.com:587')
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login('gundlach@gmail.com', GLOBAL_password)
    msg = '''\
From: %s
To: %s
Subject: %s

%s''' % (from_, to, subject, body)
    server.sendmail(from_, to, msg)
    server.quit()

def donation_message_count(max_count):
    try:
        m = donation_mailbox(True)
        return min(len(m.search(None, 'UNSEEN')[1][0].split()), max_count)
    finally:
        m.logout()

def donation_mailbox(readonly=False):
    m = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    m.login('gundlach@gmail.com', GLOBAL_password)
    m.select('afc/donations', readonly) # if readonly=False, fetching will mark as read
    # http://tools.ietf.org/html/rfc3501.html has all the things you can search with
    return m

def donation_messages(max_count):
    """
    Return an iterator containing max_count unread donation messages.
    """
    m = donation_mailbox()
    unseens = m.search(None, 'UNSEEN')[1][0].split()[ :max_count]
    try:
        # TODO: there is surely a more efficient way to do this.
        m.select('afc/donations', readonly=True)
        data = m.fetch(','.join(unseens), '(RFC822)') # not marked as read
        msgs = [ tup[1] for tup in data[1][::2] ]
        for i, msg in enumerate(msgs):
            msgid = unseens[i]
            email_msg = email.message_from_string(msg)
            try:
                d = Donation(email_msg, msgid=msgid)
                if d.amount >= 100:
                    raise ValueError("%s donated %.2f; you need to send them something."
                                     % (d.name, d.amount))
            except ValueError, ex:
                print ("*" * 70 + '\n') * 3
                print ex.message
            except:
                print ("*" * 70 + '\n') * 3
                print "Couldn't parse message from %s; ignoring." % email_msg['from']
                print
            else: # no exception
                yield d
    except:
        print "*" * 40
        print ("Error reading your mailbox; giving up early.")
        raise
    finally:
        m.logout()

def mark_as_read_and_send(donations):
    m = donation_mailbox()
    for donation in donations:
        print "Sending to %s" % donation.email
        try:
            send('adblockforchrome@gmail.com', donation.email,
                 'I got your donation :)', donation.get_response())
        except:
            print "Failed to send -- not marking as read"
            continue

        print "Marking as read %s" % donation.email
        try:
            m.select('afc/donations')
            m.fetch(donation.msgid, '(RFC822)') # marks as read
        except:
            print "*" * 40
            print ("Error -- skipped marking %s" % donation.email)
    m.logout()



class Donation(object):

    def __init__(self, email_message, msgid):
        self.message = email_message
        self.msgid = msgid
        self._parse_message()

    @staticmethod
    def _cleanup(text):
        """Unescape =XX strings and remove \r lines."""
        def replacer(match):
            return chr(int(match.group(1), 16))
        text = re.sub('=([0-9]{2})', replacer, text)
        text = text.replace('=\r\n', '')
        text = '\n'.join(text.split('\r\n'))
        text = text.strip()
        return text

    def _parse_message(self):
        self.email = re.search('<(.*?)>', self.message['from']).group(1)
        try:
            self.body = self.message.get_payload()[0].get_payload()
        except AttributeError:
            self.body = self.message.get_payload()
        self.name = re.search('Contributor: (.*)', self.body).group(1).strip()
        self.nickname = self.name.split(' ')[0].title()
        self.note = re.search('Message: (.*?)=20', self.body, re.DOTALL)
        if not self.note:
            self.note = re.search('payment: Note: (.*?)Contributor:',
                                  self.body, re.DOTALL)
        if self.note:
            self.note = self.note.group(1)
            self.note = self._cleanup(self.note)
        browser_re = 'Purpose: AdBlock for ([a-zA-Z]+)'
        self.browser = re.search(browser_re, self.body).group(1)
        amount = re.search('Total amount: *=24(.*?) USD', self.body).group(1)
        self.amount = float(amount.strip())

    def set_response(self, body):
        self._response = body

    def get_response(self):
        if hasattr(self, '_response'):
            return self._response
        original = """

Hello Michael Gundlach,

This email confirms that you have received a donation of $%(amount).2f USD
from %(name)s (%(email)s).

Donation details:
  Total amount: $%(amount).2f
  Currency: U.S. Dollars
  Purpose: AdBlock for %(browser)s
  Contributor: %(name)s
  Note: %(note)s

Sincerely,
Paypal
""" % self.__dict__
        original = '\n> '.join(original.split('\n'))

        return """\
Hi %(nickname)s,

I recently took the plunge and am now working on AdBlock as my full time job, supported only by donations.  Not a lot of users donate yet, but I hope to spread the word enough that I can support my family on AdBlock.

So THANK YOU, very much, for donating.  I wrote AdBlock hoping I could make people's lives better, and your donation tells me that I did it :)  It's great to know that I'm helping people out.

- Michael

PS: Word of mouth is my only marketing tool right now.  If you wouldn't mind helping spread the word, would you
  1) "Like" AdBlock via http://%(browser)sadblock.com/like ,
  2) post to Facebook/Twitter about %(browser)sadblock.com, and
  3) in your post, challenge your friends to donate too?
If you don't use FB/Twitter or just don't feel comfortable asking your friends to donate, don't worry about it :)

%(original)s
""" % dict(nickname=self.nickname,
           original=original,
           browser=self.browser.lower())


def main(number_to_thank=1000000, notes=None):
    donation_count = donation_message_count(number_to_thank)
    i = 0
    thanked = []
    for donation in donation_messages(number_to_thank):
        i += 1
        if notes is not None and (not not donation.note) != notes:
            print "Skipping $%.2f from %s due to %s note" % (
                    donation.amount, donation.name,
                    "lack of" if notes else "having a")
            continue
        print "%d of %d" % (i, donation_count)
        if donation.note:
            print
            print
            print "-" * 30
            print "Note attached:"
            print "-" * 30
            print
            print
            print donation.note
            print
            print "-" * 30
            print
        print " $%.2f (%s)" % (donation.amount, donation.browser)
        print " %s" % donation.email
        print " %s" % donation.name
        nick = raw_input("'%s'? [Press Enter or type a nickname correction.] " % donation.nickname)
        if nick:
            donation.nickname = nick
        if donation.note:
            if 'n' != raw_input("Press 'n' to skip composing a custom reply. "):
                open('/tmp/reply.txt', 'w').write(donation.get_response())
                os.system('vim /tmp/reply.txt')
                donation.set_response(open('/tmp/reply.txt').read())

        thanked.append(donation)
        print
        print

    for k in range(5):
        print
    for d in thanked:
        print "$%2.0f (%s) %s -- %s" % (d.amount, d.browser, d.name, d.note)
    print
    chromes = [d.amount for d in thanked if d.browser == 'Chrome']
    safaris = [d.amount for d in thanked if d.browser != 'Chrome']
    print "%d Chrome donations totalling $%.2f." % (len(chromes), sum(chromes))
    print "%d Safari donations totalling $%.2f." % (len(safaris), sum(safaris))
    print

    mark_as_read_and_send(thanked)


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
        notes = eval(sys.argv[2]) # True: only show notes.  False: show none.
        main(count, notes)
    else:
        main()
