#!/usr/bin/python

# see http://www.doughellmann.com/PyMOTW/imaplib/ for an excellent walkthrough

import csv
import email
import imaplib
import getpass
import os
import re
import smtplib

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
    unseens = m.search(None, '(UNSEEN)')[1][0].split()[ :max_count]
    try:
        # TODO: there is surely a more efficient way to do this.
        m.select('afc/donations', readonly=True)
        data = m.fetch(','.join(unseens), '(RFC822)') # not marked as read
        msgs = [ tup[1] for tup in data[1][::2] ]
        for i, msg in enumerate(msgs):
            msgid = unseens[i]
            email_msg = email.message_from_string(msg)
            try:
                d = Donation(msgid=msgid, message=email_msg)
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


class Donation(object):

    def __init__(self, **kwargs):
        self.note = self.body = self.message = None
        # Pull data out of message, if it exists
        if 'message' in kwargs:
            self.message = kwargs['message']
            self._parse_message()
        # Then override results as specified
        for k,v in kwargs.iteritems():
            setattr(self, k, v)

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
        if 'Contributor' not in self.body:
            import base64
            self.body = base64.decodestring(self.body)
        self.name = re.search('Contributor: (.*)', self.body).group(1).strip()
        self.nickname = self.name.split(' ')[0].title()
        self.note = re.search('Message: (.*?)=20', self.body, re.DOTALL)
        if not self.note:
            self.note = re.search('payment: Note: (.*?)Contributor:',
                                  self.body, re.DOTALL)
        if self.note:
            self.note = self.note.group(1)
            self.note = self._cleanup(self.note)
        browser_re = 'Purpose: AdBlock [fF]or ([a-zA-Z]+)'
        self.browser = re.search(browser_re, self.body).group(1)
        amount = re.search('Total amount: *(=24|\$)(.*?) USD', self.body).group(2)
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
Hi %(nickname)s!

I wrote AdBlock in the hope that I could make people's lives better.  Your
donation tells me that I did it :)  Thank you very, very much!  You are so
great!

It has been scary taking a risk, quitting my job, and hoping to support my
family and fund AdBlock development using only AdBlock donations.  Not a lot
of users donate yet, which makes your donation even more appreciated --
your donation is way above what most users give: zero.  Did I say thank you
yet?  Thank you! :D

Happy ad blocking,
- Michael

PS: If you don't mind, please post to Facebook or Twitter about
%(browser)sadblock.com, asking your friends to donate if they like it as much
as you do.  It would help me IMMENSELY :)


%(original)s
""" % dict(nickname=self.nickname,
           original=original,
           browser=self.browser.lower())


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


def mark_as_read_and_send(donations):
    print "Press enter to mark emails as read and send replies."
    raw_input()
    m = donation_mailbox()
    ids = ','.join(d.msgid for d in donations)
    print "Marking these msgids as read:"
    print ids
    # Mark all as read
    m.store(ids, '+FLAGS.SILENT', '\\Seen')
    for (i,d) in enumerate(donations):
        print "Sending %d of %d to %s ('%s' - %s)" % (i+1, len(donations),
            d.email, d.nickname, d.name)
        try:
            send('adblockforchrome@gmail.com', d.email,
                 'I got your donation :)', d.get_response())
        except:
            print "  %s Failed to send" % ("*" * 40)
            continue

def with_corrected_nicknames(donations):
    """
    Return a list of donations like the input but with nicknames corrected
    by the user.
    """
    f = open('/tmp/nicknames.csv', 'w')
    writer = csv.writer(f, delimiter='\t')
    for d in donations:
        writer.writerow([d.nickname,d.name,d.email,d.amount,
                         d.browser,d.msgid,d.note.replace("\t", " ")])
    f.close()
    print "Press enter to edit nicknames."
    raw_input()
    os.system('vim /tmp/nicknames.csv')
    reader = csv.reader(open('/tmp/nicknames.csv'), delimiter='\t')
    return [ Donation(amount=float(amount), browser=browser, msgid=msgid,
                      email=email, name=name, nickname=nickname, note=note)
             for nickname,name,email,amount,browser,msgid,note in reader ]

def thank_notes(number_to_thank=200):
    donations = [ d for d in donation_messages(number_to_thank) if d.note ]
    donations = with_corrected_nicknames(donations)
    for (i,d) in enumerate(donations):
        print "Press enter to edit message %d of %d." % (i+1, len(donations))
        raw_input()
        open('/tmp/reply.txt', 'w').write(d.get_response())
        os.system('vim -c "0;0" /tmp/reply.txt')
        d.set_response(open('/tmp/reply.txt').read())
    mark_as_read_and_send(donations)

def thank_no_notes(number_to_thank=200):
    donations = [ d for d in donation_messages(number_to_thank) if not d.note ]
    donations = with_corrected_nicknames(donations)
    mark_as_read_and_send(donations)

def usage():
    print "Usage: thanks.py yes - respond to notes"
    print "       thanks.py no  - respond to non-notes"

def main():
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in ['no', 'yes']:
        usage()
        return
    global GLOBAL_password
    GLOBAL_password = getpass.getpass("Password for gundlach@gmail.com: ")
    if sys.argv[1] == 'yes':
        thank_notes()
    else:
        thank_no_notes()

if __name__ == '__main__':
    main()
