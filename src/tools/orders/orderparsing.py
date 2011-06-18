import urllib2
from xml.dom import minidom
import MySQLdb
import pickle

DATA = None
def init(info_filename):
    """Call this before using the module."""
    global DATA
    DATA = pickle.load(open(info_filename))


def get(node, childName):
    return node.getElementsByTagName(childName)[0]

def text(node, childName):
    """
    Return the text of the child node within node, or "" if it doesn't
    exist.
    """
    try:
        node = get(node, childName)
    except:
        return ""
    rc = []
    for child in node.childNodes:
        if child.nodeType == node.TEXT_NODE:
            rc.append(child.data)
    return ''.join(rc)

class GoogleOrderParser(object):

    @staticmethod
    def parse(orderid_list):
        """
        Return order data dictionaries for each order number in the array.
        Dicts contain id, date, item_number, email, name, amount.
        """

        url = "https://checkout.google.com/api/checkout/v2/reports/Merchant/%s"  % DATA['google_merchant_id']
        headers = {
            "Content-Type": "application/xml; charset=UTF-8",
            "Accept": "application/xml; charset=UTF8",
            "Authorization": "Basic %s" % DATA['google_merchant_hash']
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
        return [ GoogleOrderParser.createOrderFrom(n) for n in notifications ]

    @staticmethod
    def createOrderFrom(cn):
        """cn: charge-amount-notification minidom node"""
        return {
            'id': text(cn, 'google-order-number'),
            'date': text(cn, 'purchase-date'),
            'tracking': text(cn, 'merchant-private-data'),
            'email': text(cn, 'email'),
            'name': text(cn, 'contact-name'),
            'amount': text(cn, 'latest-charge-amount'),
        }

class Tracking(object):
    """Extracts tracking info for orders."""

    @staticmethod
    def load_from_database(orders):
        """
        Load tracking info from the database, if available, for each Order.
        Orders should have a userid.
        """
        # TODO Temp for X5
        db_msg_table = raw_input('Enter db message table name: ')

        order_map = dict( (o.userid, o) for o in orders )
        userids = ','.join("'%s'" % u for u in order_map.iterkeys())

        conn = MySQLdb.connect(host="chromeadblock.com",
                               user=DATA['db_user'],
                               passwd=DATA['db_pass'],
                               db=DATA['db_name'])
        cursor = conn.cursor(MySQLdb.cursors.DictCursor)
        #query = ("SELECT * FROM %s WHERE userid in (%s)" %
        #               (DATA['db_users_table'], userids))

        # TODO Temp for X5
        query = ("SELECT * FROM %(t1)s t1 LEFT JOIN %(t2)s t2 ON t1.id = t2.%(t1)s_id WHERE t1.id in (%(userids)s) AND (t2.id is null OR (length(t2.message) = 4 AND t2.message like 'X5G_'))" %
                dict(t1=DATA['db_users_table'],
                     t2=db_msg_table,
                     userids=userids))

        cursor.execute(query)
        result_set = cursor.fetchall()
        cursor.close()
        conn.close()

        for row in result_set:
            userid = row['id']
            order = order_map[userid]
            order.flavor = row['flavor']
            order.os = row['os']

            # TODO Temp for X5
            if row['message']:
              order.experiment = 5
              order.group = int(row['message'][3]) # 'X5G2' -> '2'
