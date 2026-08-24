When searching a client's name, addresses, contacts.

A single result option should show the client name, and also one or both of an address and contact name, if either are matched.

If the search text matches just the client name, display the top address and contact name if available.

If the search matches an address or contact name, those should appear in stronger text.

Should a client show up more than once if multiple addresses/contacts are matched?  Probably not?

Search results should be the intersection of results matched by all search tokens, so each token filters down the results.

Implement v1 as two passes: a naive good-enough filter in one pass, and a sorting pass.

## Naive search

Element in the search array: every possible combination of client, address, contact.  Address or contact can only be null if there are 0 addresses/contacts for that client.  Results with the same client should be next to each other, first in address sort order, then contact sort order.

Once when building: for each item, build the set of index tokens made up of all the relevant strings.  The separate tokens for client/address/contact will also need to be addressable.

When matching a set of search tokens: every search token must match the beginning of an index token.  Don't bother checking a record if we already matched a record with the same client id.  Calculate the number of partial and full matches for each of client/address/contact.

## Sorting

In the client name: more tokens matched puts you higher

In the client name: more perfect matches puts you higher

