<!-- NOTE: This file is generated from skewer.yaml.  Do not edit it directly. -->

# Redis Multicloud High Availability using Skupper

#### Secure Redis servers across multiple distributed Kubernetes clusters

This example is part of a [suite of examples][examples] showing the
different ways you can use [Skupper][website] to connect services
across cloud providers, data centers, and edge sites.

[website]: https://skupper.io/
[examples]: https://skupper.io/examples/index.html

#### Contents

* [Overview](#overview)
* [Step 1: Install the Skupper command-line tool](#step-1-install-the-skupper-command-line-tool)
* [Step 2: Set up your Kubernetes cluster](#step-2-set-up-your-kubernetes-cluster)
* [Step 3: Set up your Podman environment](#step-3-set-up-your-podman-environment)
* [Step 4: Install the Skupper controller](#step-4-install-the-skupper-controller)
* [Step 5: Create your sites](#step-5-create-your-sites)
* [Step 6: Deploy Redis Server and Sentinel](#step-6-deploy-redis-server-and-sentinel)
* [Step 7: Expose Redis Server and Sentinel to Application Network](#step-7-expose-redis-server-and-sentinel-to-application-network)
* [Step 8: Link your sites](#step-8-link-your-sites)
* [Step 9: Create Podman site](#step-9-create-podman-site)
* [Step 10: Use Redis command line interface to verify master status](#step-10-use-redis-command-line-interface-to-verify-master-status)
* [Step 11: Deploy the wiki-getter service](#step-11-deploy-the-wiki-getter-service)
* [Step 12: Get Wiki content](#step-12-get-wiki-content)
* [Step 13: Force Sentinel failover](#step-13-force-sentinel-failover)
* [Step 14: Verify Wiki content](#step-14-verify-wiki-content)
* [Step 15: Use Redis command line to measure latency of servers from each site](#step-15-use-redis-command-line-to-measure-latency-of-servers-from-each-site)
* [Step 16: Cleaning up](#step-16-cleaning-up)
* [Summary](#summary)
* [Next steps](#next-steps)
* [About this example](#about-this-example)

## Overview

This example deploys a simple highly available Redis architecture with
Sentinel across multiple Kubernetes clusters using Skupper.

In addition to the Redis Server and Sentinel, the example contains
an additional service:

* A wiki-getter service that exposes an `/api/search?query=` endpoint. 
  The server returns the result from the Redis cache if present otherwise
  it will retrieve the query via the `wiki api` and cache the content via
  the Redis primary server.

With Skupper, you can place the Redis primary server in one cluster and 
the replica servers in alternative clusters without requiring that
the servers be exposed to the public internet.

## Step 1: Install the Skupper command-line tool

This example uses the Skupper command-line tool to deploy Skupper.
You need to install the `skupper` command only once for each
development environment.

On Linux or Mac, you can use the install script (inspect it
[here][install-script]) to download and extract the command:

~~~ shell
curl https://skupper.io/install.sh | sh
~~~

The script installs the command under your home directory.  It
prompts you to add the command to your path if necessary.

For Windows and other installation options, see [Installing
Skupper][install-docs].

[install-script]: https://github.com/skupperproject/skupper-website/blob/main/input/install.sh
[install-docs]: https://skupper.io/install/

## Step 2: Set up your Kubernetes cluster

Open a new terminal window and log in to your cluster.  Then
create the namespace you wish to use and set the namespace on your
current context.

**Note:** The login procedure varies by provider.  See the
documentation for your chosen providers:

* [Minikube](https://skupper.io/start/minikube.html#cluster-access)
* [Amazon Elastic Kubernetes Service (EKS)](https://skupper.io/start/eks.html#cluster-access)
* [Azure Kubernetes Service (AKS)](https://skupper.io/start/aks.html#cluster-access)
* [Google Kubernetes Engine (GKE)](https://skupper.io/start/gke.html#cluster-access)
* [IBM Kubernetes Service](https://skupper.io/start/ibmks.html#cluster-access)
* [OpenShift](https://skupper.io/start/openshift.html#cluster-access)

_**West:**_

~~~ shell
# Enter your provider-specific login command
kubectl create namespace west
kubectl config set-context --current --namespace west
~~~

_**East:**_

~~~ shell
# Enter your provider-specific login command
kubectl create namespace east
kubectl config set-context --current --namespace east
~~~

_**North:**_

~~~ shell
# Enter your provider-specific login command
kubectl create namespace north
kubectl config set-context --current --namespace north
~~~

## Step 3: Set up your Podman environment

Open a new terminal window and set the `SKUPPER_PLATFORM`
environment variable to `podman`.  This sets the Skupper platform
to Podman for this terminal session.

Use `podman network create` to create the Podman network that
Skupper will use.

Use `systemctl` to enable the Podman API service.

_**Podman West:**_

~~~ shell
export SKUPPER_PLATFORM=podman
podman network create skupper
systemctl --user enable --now podman.socket
~~~

If the `systemctl` command doesn't work, you can try the `podman
system service` command instead:

~~~
podman system service --time=0 unix://$XDG_RUNTIME_DIR/podman/podman.sock &
~~~

## Step 4: Install the Skupper controller

_**West:**_

~~~ shell
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_access_grant_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_access_token_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_attached_connector_anchor_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_attached_connector_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_certificate_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_connector_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_link_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_listener_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_router_access_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_secured_access_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/api/types/crds/skupper_site_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/skupperproject/skupper/v2/cmd/controller/deploy_cluster_scope.yaml
~~~

## Step 5: Create your sites

A Skupper _site_ is a location where components of your
application are running.  Sites are linked together to form a
Skupper network for your application.

Use the `kubectl apply` command to declaratively create sites
in the kubernetes namespaces. This deploys the Skupper router. 
Then use `kubectl get site` to see the outcome.

**Note:** If you are using Minikube, you need to [start minikube
tunnel][minikube-tunnel] before you run `kubectl apply`.

[minikube-tunnel]: https://skupper.io/start/minikube.html#running-minikube-tunnel

_**West:**_

~~~ shell
kubectl apply -f ./west-crs/site-west.yaml
~~~

_**East:**_

~~~ shell
kubectl apply -f ./east-crs/site-east.yaml
~~~

_**North:**_

~~~ shell
kubectl apply -f ./north-crs/site-north.yaml
~~~

As you move through the steps below, you can use `kubectl get` at
any time on a resource to check your progress.

## Step 6: Deploy Redis Server and Sentinel

A _yaml_ file defines the resources for the Redis deployment in each
site. Each contains:

- A Server deployment resource
- A Sentinel deployment resource
- A Redis config map for configuration

** Note ** the `redis-north.yaml` file designates the server to be
primary while the other sites are designated as replica sites to north.

_**West:**_

~~~ shell
kubectl apply -f ./west-crs/redis-west.yaml
~~~

_**East:**_

~~~ shell
kubectl apply -f ./east-crs/redis-east.yaml
~~~

_**North:**_

~~~ shell
kubectl apply -f ./north-crs/redis-north.yaml
~~~

** Note ** the Sentinel deployments in each site use an init container
that waits for the service definitions of the Redis servers in all
sites to exist before execution. This will be satisfied by the next
step.

## Step 7: Expose Redis Server and Sentinel to Application Network

We will create links and connectors in the sites to expose the server and 
sentinel deployments in each namespace

_**West:**_

~~~ shell
kubectl apply -f ./west-crs/listener-west.yaml
kubectl apply -f ./west-crs/connector-west.yaml
~~~

_**East:**_

~~~ shell
kubectl apply -f ./east-crs/listener-east.yaml
kubectl apply -f ./east-crs/connector-east.yaml
~~~

_**North:**_

~~~ shell
kubectl apply -f ./north-crs/listener-north.yaml
kubectl apply -f ./north-crs/connector-north.yaml
~~~

## Step 8: Link your sites

A Skupper _link_ is a channel for communication between two sites.
Links serve as a transport for application connections.

Creating a link requires use of a `skupper` command to generate 
a link resource (with details and a secret token) and then activating 
the link via `kubectl apply` in the appropriate namespaces.

_**West:**_

~~~ shell
skupper link generate > ./declarative/link-to-west.yaml
~~~

_**East:**_

~~~ shell
skupper link generate > ./declarative/link-to-east.yaml
kubectl apply -f ./declarative/link-to-west.yaml
~~~

_**North:**_

~~~ shell
skupper link generate > ./declarative/link-to-north.yaml
kubectl apply -f ./declarative/link-to-west.yaml
kubectl apply -f ./declarative/link-to-east.yaml
~~~

## Step 9: Create Podman site

A bootstrap script can be used to create a podman (non-kube) site
that instatiates the set of resources in the `declarative` directory

_**Podman West:**_

~~~ shell
curl -s https://raw.githubusercontent.com/skupperproject/skupper/refs/heads/v2/cmd/bootstrap/bootstrap.sh | sh -s -- -p ./declarative
~~~

## Step 10: Use Redis command line interface to verify master status

Running the `redis-cli` from the podman-west site, attach to the Redis server
and Sentinel to verfy that the redis-server-north is master.

_**Podman West:**_

~~~ shell
redis-cli -p 6379
127.0.0.1:6379> ROLE
127.0.0.1:6379> exit
redis-cli -p 26379
127.0.0.1:26379> sentinel get-master-addr-by-name redis-skupper
127.0.0.1:26379> exit
~~~

_Sample output:_

~~~ console
$ 127.0.0.1:6379> ROLE
1) "master"
2) (integer) 1531796
3) 1) 1) "redis-server-west"
      2) "6379"
      3) "1531796"
   2) 1) "redis-server-east"
      2) "6379"
      3) "1531796"

$ 127.0.0.1:26379> sentinel get-master-addr-by-name redis-skupper
1) "redis-server-north"
2) "6379"
~~~

## Step 11: Deploy the wiki-getter service

We will choose the north namespace to create a wiki-getter deployment
and service. The client in the service will determine the 
Sentinel service to access the current Redis primary server
for query and cache updates.

_**North:**_

~~~ shell
kubectl apply -f wiki-getter.yaml
~~~

_Sample output:_

~~~ console
$ kubectl apply -f wiki-getter.yaml
deployment.apps/wiki-getter created
service/wiki-getter created
~~~

## Step 12: Get Wiki content

Use `curl` to send a request to querty the Wikipedia API via the 
wiki-getter service. Note the *X-Response-Time* header for the initial
query. The application will check the redis cache and if not found
will fetch from the external Wikipedia API. If the content has been 
stored, the applications will provide the response directly.

_**North:**_

~~~ shell
kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
~~~

_Sample output:_

~~~ console
$ kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 132099
ETag: W/"20403-PfBW245Yreh1Gm27jHeiM01Wox8"
X-Response-Time: 1545.706ms
Date: Fri, 29 Mar 2024 12:48:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 132097
ETag: W/"20401-7u+hiY6DPz+D2DHbukm0QE/L82s"
X-Response-Time: 5.847ms
Date: Fri, 29 Mar 2024 12:48:58 GMT
Connection: keep-alive
Keep-Alive: timeout=5
~~~

## Step 13: Force Sentinel failover

Using the Sentinel command, force a failover as if the master was not reachable. This
will result in the promotion of one of the slave Redis servers to master role.

_**Podman West:**_

~~~ shell
redis-cli -p 26379
127.0.0.1:26379> sentinel failover redis-skupper
127.0.0.1:26379> sentinel get-master-addr-by-name redis-skupper
127.0.0.1:26379> exit
~~~

_Sample output:_

~~~ console
$ 127.0.0.1:26379> sentinel failover redis-skupper
OK
(0.66s)

$ 127.0.0.1:26379> sentinel get-master-addr-by-name redis-skupper
1) "redis-server-west"
2) "6379"
~~~

Note that `redis-server-east` may have alternatively been elected master role.

## Step 14: Verify Wiki content

Check that cached content is correctly returned from new master.

_**North:**_

~~~ shell
kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
~~~

_Sample output:_

~~~ console
$ kubectl exec -it deployment/wiki-getter -- curl -f -I --head http://wiki-getter:8080/api/search?query=Boston
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 132097
ETag: W/"20401-7u+hiY6DPz+D2DHbukm0QE/L82s"
X-Response-Time: 152.056ms
Date: Fri, 29 Mar 2024 12:50:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5
~~~

## Step 15: Use Redis command line to measure latency of servers from each site

To understand latency in a true multicloud scenario, the redis-cli can be used to
measure the latency of a Redis server in milliseconds from any application network
site.

_**West:**_

~~~ shell
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
~~~

_Sample output:_

~~~ console
$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
0 10 1.41 88

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
76 254 96.40 10

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
33 104 44.00 19
~~~

_**East:**_

~~~ shell
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
~~~

_Sample output:_

~~~ console
$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
79 110 85.45 11

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
0 26 1.28 89

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
113 358 149.14 7
~~~

_**North:**_

~~~ shell
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
~~~

_Sample output:_

~~~ console
$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-west -p 6379 --raw
33 103 38.71 21

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-east -p 6379 --raw
115 161 125.25 8

$ kubectl exec -it deployment/redis-server -- redis-cli --latency -h redis-server-north -p 6379 --raw
0 19 0.88 94
~~~

_**Podman West:**_

~~~ shell
redis-cli --latency -p 6379 --raw
redis-cli --latency -p 6380 --raw
redis-cli --latency -p 6381 --raw
~~~

_Sample output:_

~~~ console
$ redis-cli --latency -p 6379 --raw
62 88 68.85 13

$ redis-cli --latency -p 6380 --raw
28 38 32.88 24

$ redis-cli --latency -p 6381 --raw
110 280 141.43 7
~~~

The sample period output is latency min, max, average over the number of samples. Note, that the sample
outputs provided are actual measures across three public cloud locations (Washington DC, London, and Dallas)

## Step 16: Cleaning up

To remove Skupper and other resource from this exercise, use the
following commands.

_**West:**_

~~~ shell
kubectl delete ns west
~~~

_**East:**_

~~~ shell
kubectl delete ns east
~~~

_**North:**_

~~~ shell
kubectl delete ns north
~~~

_**Podman West:**_

~~~ shell
curl -s https://raw.githubusercontent.com/skupperproject/skupper/refs/heads/v2/cmd/bootstrap/remove.sh | sh
~~~

## Summary

This example locates the Redis Server and Sentinel services in different
namespaces, on different clusters.  Ordinarily, this means that they
have no way to communicate unless they are exposed to the public
internet.

Introducing Skupper into each namespace allows us to create a virtual
application network that can connect Redis services in different clusters.
Any service exposed on the application network is represented as a
local service in all of the linked namespaces.

The Redis primary server is located in `north`, but the Redis replica
services in `west` and `east` can "see" it as if it were local.
Redis replica operations take place by service name and Skupper
forwards the requests to the namespace where the corresponding server
is running and routes the response back appropriately.

## Next steps

Check out the other [examples][examples] on the Skupper website.

## About this example

This example was produced using [Skewer][skewer], a library for
documenting and testing Skupper examples.

[skewer]: https://github.com/skupperproject/skewer

Skewer provides utility functions for generating the README and
running the example steps.  Use the `./plano` command in the project
root to see what is available.

To quickly stand up the example using Minikube, try the `./plano demo`
command.
