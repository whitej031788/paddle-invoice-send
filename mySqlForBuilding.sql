select *
from business_buyers
where vendor_id = 33113

delete from business_addresses
where created_at > '2019-06-19 15:39:42'
and business_buyer_id in (select id from business_buyers
where vendor_id = 33113
and created_at > '2019-06-19 15:39:42')

delete from business_buyers
where vendor_id = 33113
and created_at > '2019-06-19 15:39:42'