import urllib2
from xml.dom import minidom

execfile('../../google_credentials')

def get(node, childName):
    return node.getElementsByTagName(childName)[0]

def text(node):
    rc = []
    for child in node.childNodes:
        if child.nodeType == node.TEXT_NODE:
            rc.append(child.data)
    return ''.join(rc)

class OrderParser(object):
    """
    Abstract.  Returns a standard order info dictionaries for each order id.
    """
    def from(orderid_list):
        """
        Return a bunch of order dicts from the list of order ids.
        Dicts contain id, date, item_number, email, name, amount.
        """

class GoogleOrderParser(OrderParser):
    def from(orderid_list):

        """Return order data dictionaries for each order number in the
        array."""

        url = "https://checkout.google.com/api/checkout/v2/reports/Merchant/%s"  % google_merchant_id
        headers = {
            "Content-Type": "application/xml; charset=UTF-8",
            "Accept": "application/xml; charset=UTF8",
            "Authorization": "Basic %s" % google_hash
            }
        template = '<google-order-number>%s</google-order-number>'
        order_xml = ''.join(template % oid for oid in orderid_list)
        data = """
          <notification-history-request xmlns="http://checkout.google.com/schema/2">
              <order-numbers>%s</order-numbers>
              <notification-types>
                  <notification-type>charge-amount</notification-type>
              </notification-types>
          </notification-history-request>
        """ % order_xml
        req = urllib2.Request(url, data, headers)
        dom = minidom.parseString(urllib2.urlopen(req).read())
        notifications = dom.getElementsByTagName('charge-amount-notification')
        return [ self.createOrderFrom(n) for n in notifications ]

    def createOrderFrom(self, cn):
        """cn: charge-amount-notification minidom node"""
        return {
            'id': text(get(cn, 'google-order-number')),
            'date': text(get(cn, 'purchase-date')),
            'item_number': text(get(cn, 'merchant-private-data')),
            'email': text(get(cn, 'email')),
            'name': text(get(cn, 'contact-name')),
            'amount': text(get(cn, 'latest-charge-amount')),
        }

# TODO
class PaypalOrderParser(OrderParser):
    def from(confirmationid_list):
        return [{}]
